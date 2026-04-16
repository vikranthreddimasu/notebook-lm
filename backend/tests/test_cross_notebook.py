from __future__ import annotations

import pytest
from notebooklm_backend.config import AppConfig
from notebooklm_backend.services.vector_store import VectorStoreManager, create_vector_store
from notebooklm_backend.services.chunking import TextChunk


@pytest.fixture
def settings(tmp_path):
    return AppConfig(
        workspace_root=tmp_path,
        data_dir=tmp_path / "data",
        models_dir=tmp_path / "models",
        index_dir=tmp_path / "indexes",
        cache_dir=tmp_path / "cache",
        embedding_backend="hash",
    )


@pytest.fixture
def store(settings):
    from notebooklm_backend.services.embeddings import create_embedding_backend
    embedding = create_embedding_backend(settings)
    return create_vector_store(settings, embedding)


def _make_chunks(source_path: str, texts: list[str]) -> list[TextChunk]:
    return [
        TextChunk(chunk_id=f"{source_path}-{i}", text=t, source_path=source_path, order=i)
        for i, t in enumerate(texts)
    ]


def test_query_across_notebooks_merges_results(store):
    """Results from multiple notebooks are merged and ranked by distance."""
    store.add_chunks("nb1", _make_chunks("paper_a.pdf", [
        "Machine learning improves accuracy",
        "Deep learning requires large datasets",
    ]))
    store.add_chunks("nb2", _make_chunks("paper_b.pdf", [
        "Neural networks are powerful models",
        "Transfer learning reduces training time",
    ]))

    result = store.query_across_notebooks(
        notebook_ids=["nb1", "nb2"],
        query="machine learning models",
        top_k=4,
    )

    docs = result["documents"][0]
    metas = result["metadatas"][0]

    assert len(docs) == 4
    # Each result should have notebook_id in metadata
    nb_ids = [m["notebook_id"] for m in metas]
    assert "nb1" in nb_ids
    assert "nb2" in nb_ids


def test_query_across_notebooks_respects_top_k(store):
    """Only top_k results returned even when more exist across notebooks."""
    store.add_chunks("nb1", _make_chunks("doc1.txt", ["text one", "text two", "text three"]))
    store.add_chunks("nb2", _make_chunks("doc2.txt", ["text four", "text five"]))

    result = store.query_across_notebooks(
        notebook_ids=["nb1", "nb2"],
        query="text",
        top_k=3,
    )

    assert len(result["documents"][0]) == 3


def test_query_across_notebooks_empty_notebook_skipped(store):
    """Empty or nonexistent notebooks don't cause errors."""
    store.add_chunks("nb1", _make_chunks("doc.txt", ["some content here"]))

    result = store.query_across_notebooks(
        notebook_ids=["nb1", "nb_nonexistent"],
        query="content",
        top_k=5,
    )

    docs = result["documents"][0]
    assert len(docs) == 1
    assert result["metadatas"][0][0]["notebook_id"] == "nb1"


def test_query_across_notebooks_all_empty(store):
    """Returns empty results when all notebooks are empty/missing."""
    result = store.query_across_notebooks(
        notebook_ids=["nb_missing_1", "nb_missing_2"],
        query="anything",
        top_k=5,
    )

    assert result["documents"] == [[]]


def test_query_across_notebooks_single_notebook_fallback(store):
    """Works correctly with just one notebook (degrades gracefully)."""
    store.add_chunks("nb1", _make_chunks("paper.pdf", [
        "Important finding about climate",
        "Temperature data shows warming",
    ]))

    result = store.query_across_notebooks(
        notebook_ids=["nb1"],
        query="climate temperature",
        top_k=2,
    )

    docs = result["documents"][0]
    assert len(docs) == 2
    assert all(m["notebook_id"] == "nb1" for m in result["metadatas"][0])


def test_query_across_notebooks_results_sorted_by_distance(store):
    """Results are sorted by distance (best first)."""
    store.add_chunks("nb1", _make_chunks("a.txt", ["alpha text"]))
    store.add_chunks("nb2", _make_chunks("b.txt", ["beta text"]))

    result = store.query_across_notebooks(
        notebook_ids=["nb1", "nb2"],
        query="alpha text",
        top_k=2,
    )

    distances = result["distances"][0]
    assert distances == sorted(distances), "Results should be sorted by ascending distance"
