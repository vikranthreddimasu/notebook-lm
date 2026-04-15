from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from ..models.notebook import CreateNotebookRequest, IngestionJobStatus, NotebookMetadata
from ..services.notebook_store import NotebookStore

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


@router.delete("/{notebook_id}")
async def delete_notebook(request: Request, notebook_id: str) -> dict[str, str]:
    store: NotebookStore = request.app.state.notebook_store
    store.delete_notebook(notebook_id)
    return {"status": "deleted", "notebook_id": notebook_id}


@router.get("/jobs", response_model=list[IngestionJobStatus])
async def list_jobs(request: Request) -> list[IngestionJobStatus]:
    store: NotebookStore = request.app.state.notebook_store
    return store.list_jobs()
