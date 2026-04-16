"""Read-only scanner for Zotero SQLite database.

Detects the Zotero data directory, reads collections and their PDF
attachments. Never modifies the Zotero database.
"""
from __future__ import annotations

import platform
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path


# Default Zotero data directory paths by platform
def _default_zotero_dir() -> Path | None:
    system = platform.system()
    home = Path.home()
    candidates = []
    if system == "Darwin":
        candidates = [
            home / "Zotero",
            home / "Library" / "Application Support" / "Zotero" / "Profiles",
        ]
    elif system == "Windows":
        candidates = [
            home / "Zotero",
            Path("C:/Users") / home.name / "Zotero",
        ]
    else:  # Linux
        candidates = [
            home / "Zotero",
            home / ".zotero" / "zotero",
        ]
    for c in candidates:
        db = c / "zotero.sqlite"
        if db.exists():
            return c
    return None


@dataclass
class ZoteroCollection:
    id: int
    name: str
    parent_id: int | None = None
    paper_count: int = 0


@dataclass
class ZoteroAttachment:
    item_id: int
    title: str
    path: Path | None = None
    content_type: str = ""


@dataclass
class ZoteroLibraryInfo:
    data_dir: Path
    db_path: Path
    storage_dir: Path
    collections: list[ZoteroCollection] = field(default_factory=list)
    total_items: int = 0
    total_pdfs: int = 0


class ZoteroScanner:
    """Read-only scanner for a Zotero library."""

    def __init__(self, data_dir: Path | None = None) -> None:
        if data_dir is None:
            data_dir = _default_zotero_dir()
        if data_dir is None:
            raise FileNotFoundError(
                "Could not find Zotero data directory. "
                "Set the path explicitly or ensure Zotero is installed."
            )
        self.data_dir = data_dir
        self.db_path = data_dir / "zotero.sqlite"
        self.storage_dir = data_dir / "storage"
        if not self.db_path.exists():
            raise FileNotFoundError(f"Zotero database not found at {self.db_path}")

    def _connect(self) -> sqlite3.Connection:
        # Open read-only to never modify the Zotero database
        conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def get_library_info(self) -> ZoteroLibraryInfo:
        conn = self._connect()
        try:
            total_items = conn.execute(
                "SELECT COUNT(*) FROM items WHERE itemTypeID != 14"  # 14 = attachment
            ).fetchone()[0]

            total_pdfs = conn.execute(
                "SELECT COUNT(*) FROM itemAttachments "
                "WHERE contentType = 'application/pdf'"
            ).fetchone()[0]

            collections = self._list_collections(conn)

            return ZoteroLibraryInfo(
                data_dir=self.data_dir,
                db_path=self.db_path,
                storage_dir=self.storage_dir,
                collections=collections,
                total_items=total_items,
                total_pdfs=total_pdfs,
            )
        finally:
            conn.close()

    def _list_collections(self, conn: sqlite3.Connection) -> list[ZoteroCollection]:
        rows = conn.execute(
            "SELECT collectionID, collectionName, parentCollectionID "
            "FROM collections ORDER BY collectionName"
        ).fetchall()

        collections = []
        for row in rows:
            # Count items in this collection
            count = conn.execute(
                "SELECT COUNT(*) FROM collectionItems WHERE collectionID = ?",
                (row["collectionID"],),
            ).fetchone()[0]

            collections.append(ZoteroCollection(
                id=row["collectionID"],
                name=row["collectionName"],
                parent_id=row["parentCollectionID"],
                paper_count=count,
            ))
        return collections

    def get_pdfs_for_collection(self, collection_id: int) -> list[ZoteroAttachment]:
        """Get all PDF attachments for items in a collection."""
        conn = self._connect()
        try:
            rows = conn.execute(
                """
                SELECT ia.itemID, ia.path, ia.contentType,
                       COALESCE(idv.value, 'Untitled') as title
                FROM collectionItems ci
                JOIN itemAttachments ia ON ia.parentItemID = ci.itemID
                LEFT JOIN itemData id ON id.itemID = ci.itemID
                    AND id.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'title')
                LEFT JOIN itemDataValues idv ON idv.valueID = id.valueID
                WHERE ci.collectionID = ?
                AND ia.contentType = 'application/pdf'
                """,
                (collection_id,),
            ).fetchall()

            attachments = []
            for row in rows:
                pdf_path = self._resolve_attachment_path(row["path"], row["itemID"], conn)
                attachments.append(ZoteroAttachment(
                    item_id=row["itemID"],
                    title=row["title"],
                    path=pdf_path,
                    content_type=row["contentType"] or "",
                ))
            return attachments
        finally:
            conn.close()

    def get_all_pdfs(self) -> list[ZoteroAttachment]:
        """Get all PDF attachments in the entire library."""
        conn = self._connect()
        try:
            rows = conn.execute(
                """
                SELECT ia.itemID, ia.path, ia.contentType,
                       COALESCE(idv.value, 'Untitled') as title
                FROM itemAttachments ia
                LEFT JOIN itemData id ON id.itemID = ia.parentItemID
                    AND id.fieldID = (SELECT fieldID FROM fields WHERE fieldName = 'title')
                LEFT JOIN itemDataValues idv ON idv.valueID = id.valueID
                WHERE ia.contentType = 'application/pdf'
                """,
            ).fetchall()

            attachments = []
            for row in rows:
                pdf_path = self._resolve_attachment_path(row["path"], row["itemID"], conn)
                attachments.append(ZoteroAttachment(
                    item_id=row["itemID"],
                    title=row["title"],
                    path=pdf_path,
                    content_type=row["contentType"] or "",
                ))
            return attachments
        finally:
            conn.close()

    def _resolve_attachment_path(
        self, stored_path: str | None, item_id: int, conn: sqlite3.Connection
    ) -> Path | None:
        """Resolve a Zotero attachment path to an actual file path."""
        if not stored_path:
            return None

        # Zotero stores paths as "storage:filename.pdf"
        if stored_path.startswith("storage:"):
            filename = stored_path[len("storage:"):]
            # Get the item key to find the storage subdirectory
            row = conn.execute(
                "SELECT key FROM items WHERE itemID = ?", (item_id,)
            ).fetchone()
            if row:
                pdf_path = self.storage_dir / row["key"] / filename
                if pdf_path.exists():
                    return pdf_path

        # Linked file: absolute path
        path = Path(stored_path)
        if path.is_absolute() and path.exists():
            return path

        return None
