from __future__ import annotations

from notebooklm_backend.config import AppConfig
from notebooklm_backend.models.notebook import NotebookIngestionRequest
from notebooklm_backend.services.notebook_store import NotebookStore


def test_notebook_store_persistence(tmp_path):
    settings = AppConfig(
        workspace_root=tmp_path,
        data_dir=tmp_path / "data",
        models_dir=tmp_path / "models",
        index_dir=tmp_path / "indexes",
        cache_dir=tmp_path / "cache",
    )
    store = NotebookStore(settings)
    request = NotebookIngestionRequest(path="sample.md", title="Sample Notebook")
    job = store.start_ingestion(request)
    assert job.status == "running"
    assert store.get_notebook(job.notebook_id) is not None

    completed = store.complete_ingestion(job.job_id, "done", source_count=2, chunk_count=10)
    assert completed.status == "completed"
    notebooks = store.list_notebooks()
    assert len(notebooks) == 1
    assert notebooks[0].source_count == 2
    assert notebooks[0].chunk_count == 10

    jobs = store.list_jobs()
    assert jobs[0].status == "completed"


def test_complete_ingestion_accumulates_counts_across_jobs(tmp_path):
    """Regression: a 2nd upload to the same notebook must add to source_count,
    not overwrite it with the per-job value."""
    settings = AppConfig(
        workspace_root=tmp_path,
        data_dir=tmp_path / "data",
        models_dir=tmp_path / "models",
        index_dir=tmp_path / "indexes",
        cache_dir=tmp_path / "cache",
    )
    store = NotebookStore(settings)
    first = store.start_ingestion(NotebookIngestionRequest(path="a.md", title="NB"))
    store.complete_ingestion(first.job_id, "done", source_count=3, chunk_count=12)

    second = store.start_ingestion(
        NotebookIngestionRequest(path="b.md", title="NB", notebook_id=first.notebook_id)
    )
    store.complete_ingestion(second.job_id, "done", source_count=2, chunk_count=7)

    nb = store.get_notebook(first.notebook_id)
    assert nb is not None
    assert nb.source_count == 5  # 3 + 2
    assert nb.chunk_count == 19  # 12 + 7
