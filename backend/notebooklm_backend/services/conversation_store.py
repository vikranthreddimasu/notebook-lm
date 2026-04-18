from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Iterable

from ..config import AppConfig


@dataclass
class Conversation:
    id: str
    notebook_id: str
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Message:
    id: str
    conversation_id: str
    role: str
    content: str
    sources: list[dict] | None = None
    created_at: datetime | None = None


class ConversationStore:
    """SQLite-backed store for chat conversations and messages."""

    SCHEMA_VERSION = 1

    def __init__(self, settings: AppConfig) -> None:
        self.db_path = settings.workspace_root / "metadata.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _connect(self) -> Iterable[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        try:
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT NOT NULL,
                    title TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL
                        REFERENCES conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    sources JSON,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_conversations_notebook "
                "ON conversations(notebook_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_messages_conversation "
                "ON messages(conversation_id)"
            )
            conn.execute(f"PRAGMA user_version = {self.SCHEMA_VERSION}")

    # ── Conversations ──────────────────────────────────────────

    def create_conversation(
        self,
        notebook_id: str,
        title: str | None = None,
    ) -> Conversation:
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id=uuid.uuid4().hex,
            notebook_id=notebook_id,
            title=title,
            created_at=now,
            updated_at=now,
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO conversations (id, notebook_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (conv.id, conv.notebook_id, conv.title,
                 conv.created_at.isoformat(), conv.updated_at.isoformat()),
            )
        return conv

    def list_conversations(self, notebook_id: str) -> list[Conversation]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM conversations WHERE notebook_id = ? "
                "ORDER BY updated_at DESC",
                (notebook_id,),
            ).fetchall()
        return [self._row_to_conversation(r) for r in rows]

    def get_conversation(self, conversation_id: str) -> Conversation | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
        return self._row_to_conversation(row) if row else None

    def update_title(self, conversation_id: str, title: str) -> None:
        now = datetime.now(timezone.utc)
        with self._connect() as conn:
            conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title, now.isoformat(), conversation_id),
            )

    def delete_conversation(self, conversation_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM conversations WHERE id = ?",
                (conversation_id,),
            )

    def delete_conversations_for_notebook(self, notebook_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM conversations WHERE notebook_id = ?",
                (notebook_id,),
            )

    # ── Messages ───────────────────────────────────────────────

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: list[dict] | None = None,
    ) -> Message:
        now = datetime.now(timezone.utc)
        msg = Message(
            id=uuid.uuid4().hex,
            conversation_id=conversation_id,
            role=role,
            content=content,
            sources=sources,
            created_at=now,
        )
        sources_json = json.dumps(sources) if sources else None
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO messages (id, conversation_id, role, content, sources, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (msg.id, msg.conversation_id, msg.role, msg.content,
                 sources_json, msg.created_at.isoformat()),
            )
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now.isoformat(), conversation_id),
            )
        return msg

    def list_messages(self, conversation_id: str) -> list[Message]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM messages WHERE conversation_id = ? "
                "ORDER BY created_at ASC",
                (conversation_id,),
            ).fetchall()
        return [self._row_to_message(r) for r in rows]

    # ── Auto-title ─────────────────────────────────────────────

    def auto_title_if_needed(self, conversation_id: str, user_message: str) -> str | None:
        """Set title from first user message if conversation has no title yet.
        Returns the new title if set, None otherwise."""
        conv = self.get_conversation(conversation_id)
        if conv is None or conv.title is not None:
            return None
        title = user_message[:50].strip()
        if not title:
            return None
        self.update_title(conversation_id, title)
        return title

    # ── Row mappers ────────────────────────────────────────────

    @staticmethod
    def _row_to_conversation(row: sqlite3.Row) -> Conversation:
        return Conversation(
            id=row["id"],
            notebook_id=row["notebook_id"],
            title=row["title"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    @staticmethod
    def _row_to_message(row: sqlite3.Row) -> Message:
        sources = None
        if row["sources"]:
            try:
                sources = json.loads(row["sources"])
            except (json.JSONDecodeError, TypeError):
                pass
        return Message(
            id=row["id"],
            conversation_id=row["conversation_id"],
            role=row["role"],
            content=row["content"],
            sources=sources,
            created_at=datetime.fromisoformat(row["created_at"]),
        )
