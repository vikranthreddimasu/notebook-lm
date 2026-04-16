from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..services.zotero_import import ZoteroScanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/zotero", tags=["zotero"])


class ZoteroCollectionResponse(BaseModel):
    id: int
    name: str
    parent_id: int | None
    paper_count: int


class ZoteroLibraryResponse(BaseModel):
    detected: bool
    data_dir: str | None = None
    total_items: int = 0
    total_pdfs: int = 0
    collections: list[ZoteroCollectionResponse] = []
    error: str | None = None


class ZoteroImportRequest(BaseModel):
    collection_ids: list[int] | None = None  # None = import all
    data_dir: str | None = None  # Override auto-detection


class ZoteroImportProgress(BaseModel):
    collection_name: str
    notebook_id: str
    pdfs_found: int
    pdfs_imported: int
    chunks_indexed: int


class ZoteroImportResponse(BaseModel):
    collections_imported: int
    total_pdfs: int
    total_chunks: int
    notebooks_created: list[str]
    progress: list[ZoteroImportProgress]
    errors: list[str]


@router.get("/detect", response_model=ZoteroLibraryResponse)
async def detect_zotero(data_dir: str | None = None) -> ZoteroLibraryResponse:
    """Detect Zotero library and list collections."""
    try:
        scanner = ZoteroScanner(data_dir=Path(data_dir) if data_dir else None)
        info = scanner.get_library_info()
        return ZoteroLibraryResponse(
            detected=True,
            data_dir=str(info.data_dir),
            total_items=info.total_items,
            total_pdfs=info.total_pdfs,
            collections=[
                ZoteroCollectionResponse(
                    id=c.id,
                    name=c.name,
                    parent_id=c.parent_id,
                    paper_count=c.paper_count,
                )
                for c in info.collections
            ],
        )
    except FileNotFoundError as e:
        return ZoteroLibraryResponse(detected=False, error=str(e))
    except Exception as e:
        logger.error(f"Zotero detection failed: {e}", exc_info=True)
        return ZoteroLibraryResponse(detected=False, error=str(e))


@router.post("/import", response_model=ZoteroImportResponse)
async def import_from_zotero(
    request: Request, body: ZoteroImportRequest
) -> ZoteroImportResponse:
    """Import PDFs from Zotero collections into Notebook LM notebooks."""
    from ..services.ingestion import IngestionService
    from ..services.notebook_store import NotebookStore

    ingestion: IngestionService = request.app.state.ingestion_service
    notebook_store: NotebookStore = request.app.state.notebook_store

    try:
        scanner = ZoteroScanner(data_dir=Path(body.data_dir) if body.data_dir else None)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    info = scanner.get_library_info()
    progress: list[ZoteroImportProgress] = []
    errors: list[str] = []
    notebooks_created: list[str] = []
    total_pdfs = 0
    total_chunks = 0

    # Determine which collections to import
    if body.collection_ids:
        collections = [c for c in info.collections if c.id in body.collection_ids]
    else:
        collections = info.collections

    if not collections:
        raise HTTPException(status_code=400, detail="No collections found to import")

    for collection in collections:
        pdfs = scanner.get_pdfs_for_collection(collection.id)
        valid_pdfs = [p for p in pdfs if p.path and p.path.exists()]

        if not valid_pdfs:
            progress.append(ZoteroImportProgress(
                collection_name=collection.name,
                notebook_id="",
                pdfs_found=len(pdfs),
                pdfs_imported=0,
                chunks_indexed=0,
            ))
            continue

        # Create a notebook for this collection
        import uuid
        from datetime import datetime, timezone
        from ..models.notebook import NotebookMetadata

        notebook_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        notebook = NotebookMetadata(
            notebook_id=notebook_id,
            title=f"Zotero: {collection.name}",
            description=f"Imported from Zotero collection '{collection.name}'",
            source_count=0,
            chunk_count=0,
            created_at=now,
            updated_at=now,
        )
        notebook_store.upsert_notebook(notebook)
        notebooks_created.append(notebook_id)

        # Import each PDF
        imported = 0
        collection_chunks = 0
        for pdf in valid_pdfs:
            try:
                result = await ingestion.ingest_path(
                    notebook_id=notebook_id,
                    path=pdf.path,
                    recursive=False,
                )
                imported += 1
                collection_chunks += result.chunks_indexed
            except Exception as e:
                errors.append(f"{collection.name}/{pdf.title}: {str(e)[:100]}")

        # Update notebook counts
        notebook.source_count = imported
        notebook.chunk_count = collection_chunks
        notebook_store.upsert_notebook(notebook)

        total_pdfs += imported
        total_chunks += collection_chunks

        progress.append(ZoteroImportProgress(
            collection_name=collection.name,
            notebook_id=notebook_id,
            pdfs_found=len(pdfs),
            pdfs_imported=imported,
            chunks_indexed=collection_chunks,
        ))

    return ZoteroImportResponse(
        collections_imported=len([p for p in progress if p.pdfs_imported > 0]),
        total_pdfs=total_pdfs,
        total_chunks=total_chunks,
        notebooks_created=notebooks_created,
        progress=progress,
        errors=errors,
    )
