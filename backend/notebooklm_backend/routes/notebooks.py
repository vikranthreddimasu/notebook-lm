from __future__ import annotations

import logging
import shutil
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from fastapi import HTTPException

from ..models.notebook import (
    CreateNotebookRequest,
    IngestionJobStatus,
    NotebookMetadata,
    RenameNotebookRequest,
)
from ..services.notebook_store import NotebookStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


@router.get("/", response_model=list[NotebookMetadata])
async def list_notebooks(request: Request) -> list[NotebookMetadata]:
    store: NotebookStore = request.app.state.notebook_store
    return store.list_notebooks()


@router.post("/", response_model=NotebookMetadata)
async def create_notebook(request: Request, body: CreateNotebookRequest) -> NotebookMetadata:
    store: NotebookStore = request.app.state.notebook_store
    notebook_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    notebook = NotebookMetadata(
        notebook_id=notebook_id,
        title=body.title,
        source_count=0,
        chunk_count=0,
        created_at=now,
        updated_at=now,
    )
    return store.upsert_notebook(notebook)


@router.patch("/{notebook_id}", response_model=NotebookMetadata)
async def rename_notebook(
    request: Request,
    notebook_id: str,
    body: RenameNotebookRequest,
) -> NotebookMetadata:
    """Rename a notebook. Only `title` is editable today."""
    store: NotebookStore = request.app.state.notebook_store
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    updated = store.rename_notebook(notebook_id, title)
    if updated is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return updated


@router.delete("/{notebook_id}")
async def delete_notebook(request: Request, notebook_id: str) -> dict[str, str]:
    store: NotebookStore = request.app.state.notebook_store
    settings = request.app.state.settings
    vector_store = request.app.state.vector_store

    # 1) Cascade: delete conversations for this notebook (messages go with them).
    from ..services.conversation_store import ConversationStore
    conv_store: ConversationStore = request.app.state.conversation_store
    conv_store.delete_conversations_for_notebook(notebook_id)

    # 2) Drop the Chroma collection(s) for this notebook so vectors don't
    #    leak into future queries and disk isn't held forever.
    try:
        vector_store.delete_notebook_collections(notebook_id)
    except Exception:
        logger.exception("Failed to delete Chroma collections for notebook %s", notebook_id)

    # 3) Remove the uploads directory for this notebook.
    uploads_dir = settings.data_dir / "uploads" / notebook_id
    if uploads_dir.exists():
        try:
            shutil.rmtree(uploads_dir)
        except Exception:
            logger.exception("Failed to remove uploads dir %s", uploads_dir)

    # 4) Finally remove the SQLite row.
    store.delete_notebook(notebook_id)

    return {"status": "deleted", "notebook_id": notebook_id}


@router.get("/jobs", response_model=list[IngestionJobStatus])
async def list_jobs(request: Request) -> list[IngestionJobStatus]:
    store: NotebookStore = request.app.state.notebook_store
    return store.list_jobs()
