from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from ..config import AppConfig
from ..services.ingestion import IngestionService, IngestionResult
from ..services.notebook_store import NotebookStore
from ..models.notebook import NotebookIngestionRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/ingest")
async def ingest_document(
    request: Request,
    file: UploadFile = File(...),
    notebook_id: str | None = Form(None),
) -> JSONResponse:
    """
    Upload and ingest a document into a notebook.
    """
    settings: AppConfig = request.app.state.settings
    ingestion_service: IngestionService = request.app.state.ingestion_service
    notebook_store: NotebookStore = request.app.state.notebook_store
    
    if not notebook_id:
        notebook_id = uuid.uuid4().hex
    
    # Save uploaded file permanently (for preview)
    settings.ensure_directories()
    uploads_dir = settings.data_dir / "uploads" / notebook_id
    uploads_dir.mkdir(parents=True, exist_ok=True)
    
    # Use original filename but ensure uniqueness
    original_filename = file.filename or "document"
    file_extension = Path(original_filename).suffix
    base_name = Path(original_filename).stem
    # If file already exists, add a suffix
    file_path = uploads_dir / original_filename
    counter = 1
    while file_path.exists():
        file_path = uploads_dir / f"{base_name}_{counter}{file_extension}"
        counter += 1
    
    job = None
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        # Verify file was saved and has content
        if not file_path.exists():
            raise HTTPException(status_code=500, detail="File was not saved correctly")
        if file_path.stat().st_size == 0:
            file_path.unlink()
            raise HTTPException(status_code=500, detail="File was saved but is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    ingestion_request = NotebookIngestionRequest(
        notebook_id=notebook_id,
        path=str(file_path),
        title=base_name,
        description=f"Uploaded via desktop UI ({original_filename})",
    )

    try:
        job = notebook_store.start_ingestion(ingestion_request)
        notebook_id = job.notebook_id
        result: IngestionResult = await ingestion_service.ingest_path(
            notebook_id=notebook_id,
            path=file_path,
            recursive=False,
        )
        notebook_store.complete_ingestion(
            job.job_id,
            message="Ingestion completed",
            source_count=result.documents_processed,
            chunk_count=result.chunks_indexed,
        )
        
        # Verify file still exists after ingestion
        if not file_path.exists():
            raise HTTPException(status_code=500, detail="File was deleted during ingestion")
        
        return JSONResponse(
            content={
                "notebook_id": result.notebook_id,
                "documents_processed": result.documents_processed,
                "chunks_indexed": result.chunks_indexed,
            }
        )
    except Exception as e:
        if job:
            notebook_store.fail_ingestion(job.job_id, str(e))
        # Don't delete files on error - we need them for preview
        # Even if ingestion fails, the file should be available for preview
        import logging
        logging.error(f"Ingestion error for {file_path}: {e}")
        logging.info(f"Keeping file for preview: {file_path}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list")
async def list_documents(
    request: Request,
    notebook_id: str,
) -> JSONResponse:
    """
    List all documents in a notebook.
    """
    from ..services.vector_store import VectorStoreManager
    
    vector_store: VectorStoreManager = request.app.state.vector_store
    
    try:
        collection = vector_store.get_collection(notebook_id)
        
        # Get all documents from the collection
        results = collection.get()
        
        if not results or not results.get("documents"):
            return JSONResponse(content={"documents": []})
        
        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])
        
        # Group by source file
        source_files: dict[str, dict] = {}
        for doc, metadata in zip(documents, metadatas):
            source_path = metadata.get("source_path", "unknown") if isinstance(metadata, dict) else "unknown"
            if source_path not in source_files:
                source_files[source_path] = {
                    "filename": Path(source_path).name if source_path != "unknown" else "Unknown",
                    "source_path": source_path,
                    "chunk_count": 0,
                    "preview": "",  # First chunk as preview
                }
            source_files[source_path]["chunk_count"] += 1
            # Use first chunk as preview
            if not source_files[source_path]["preview"] and doc:
                source_files[source_path]["preview"] = doc[:200] + "..." if len(doc) > 200 else doc
        
        documents_list = list(source_files.values())
        
        return JSONResponse(content={"documents": documents_list})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")


@router.delete("")
async def delete_document(
    request: Request,
    notebook_id: str,
    source_path: str,
) -> JSONResponse:
    """Remove a single document from a notebook — its chunks from the vector
    store, its summary row, its uploaded file, and decrement the notebook's
    counts. Notebook itself stays."""
    from urllib.parse import unquote
    from ..services.vector_store import VectorStoreManager

    settings: AppConfig = request.app.state.settings
    vector_store: VectorStoreManager = request.app.state.vector_store
    notebook_store: NotebookStore = request.app.state.notebook_store

    decoded_path = unquote(source_path)

    # 1) Drop chunks from the notebook's chroma collection.
    try:
        chunks_removed = vector_store.delete_document(notebook_id, decoded_path)
    except Exception:
        logger.exception("vector_store.delete_document failed")
        chunks_removed = 0

    # 2) Delete the uploaded file if it sits inside this notebook's scoped
    #    uploads directory. Scope-check is the same pattern as preview.
    uploads_dir = (settings.data_dir / "uploads" / notebook_id).resolve()
    filename = Path(decoded_path).name
    candidate = (uploads_dir / filename).resolve()
    if not candidate.exists() and Path(decoded_path).is_absolute():
        abs_candidate = Path(decoded_path).resolve()
        try:
            abs_candidate.relative_to(uploads_dir)
            candidate = abs_candidate
        except ValueError:
            candidate = uploads_dir / filename  # fall through — won't exist
    if candidate.exists():
        try:
            candidate.relative_to(uploads_dir)
            candidate.unlink()
        except (ValueError, OSError):
            logger.warning("could not unlink file for delete: %s", candidate)

    # 3) Decrement notebook counts by what we actually removed.
    if chunks_removed > 0:
        notebook_store.adjust_counts(notebook_id, source_delta=-1, chunk_delta=-chunks_removed)

    return JSONResponse(
        content={
            "status": "deleted",
            "notebook_id": notebook_id,
            "source_path": decoded_path,
            "chunks_removed": chunks_removed,
        }
    )


@router.get("/preview")
async def preview_document(
    request: Request,
    notebook_id: str,
    source_path: str,
) -> FileResponse:
    """
    Serve a document file for preview.
    """
    from urllib.parse import unquote
    
    settings: AppConfig = request.app.state.settings

    # Decode URL-encoded path
    decoded_path = unquote(source_path)
    incoming_path = Path(decoded_path)
    filename = incoming_path.name

    # The notebook-scoped uploads directory is the only path we'll serve from.
    # Previous versions had a cross-notebook fallback that let any notebook
    # serve any filename — a disclosure bug we're deliberately closing here.
    uploads_dir = (settings.data_dir / "uploads" / notebook_id).resolve()

    import logging

    try:
        # Resolve the candidate path within the notebook's scoped directory.
        # Strategy 1: standard new format — uploads/{notebook_id}/filename.
        candidate = (uploads_dir / filename).resolve()

        # Strategy 2: an absolute path from older metadata — accept only if
        # it resolves *inside* this notebook's uploads_dir.
        if not candidate.exists() and incoming_path.is_absolute():
            abs_candidate = incoming_path.resolve()
            try:
                abs_candidate.relative_to(uploads_dir)
                candidate = abs_candidate
            except ValueError:
                # Absolute path escapes this notebook's directory — refuse.
                raise HTTPException(status_code=403, detail="Access denied")

        # Final guard: candidate must exist AND sit inside uploads_dir
        # (protects against `..` traversal in the filename).
        if not candidate.exists():
            logging.warning("preview 404: notebook=%s filename=%s", notebook_id, filename)
            raise HTTPException(
                status_code=404,
                detail=f"File not found in notebook: {filename}",
            )
        try:
            candidate.relative_to(uploads_dir)
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")

        return FileResponse(
            path=str(candidate),
            filename=candidate.name,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{candidate.name}"',
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve file: {str(e)}")
