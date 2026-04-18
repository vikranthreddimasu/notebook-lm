from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import AsyncIterator

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from .config import AppConfig, get_settings
from .routes import (
    agent,
    chat,
    conversations,
    documents,
    export,
    health,
    metrics,
    notebooks,
    rag,
    speech,
    zotero,
)
from .services.agent import AgentService
from .services.chat import ChatService
from .services.conversation_store import ConversationStore
from .services.embeddings import create_embedding_backend
from .services.ingestion import IngestionService
from .services.llm import create_llm_backend
from .services.metrics_store import MetricsStore
from .services.model_profiles import resolve_ollama_model
from .services.notebook_store import NotebookStore
from .services.rag import RAGService
from .services.rag_llamaindex import LlamaIndexRAGService
from .services.speech import SpeechService
from .services.vector_store import create_vector_store

logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    """Create the FastAPI application for the chat-first Notebook LM backend."""
    settings: AppConfig = get_settings()
    settings.ensure_directories()

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # Resolve the preferred Ollama model in the background so a slow
        # `/api/tags` round-trip doesn't delay startup and cause Electron's
        # waitForBackend timeout to fire.
        if settings.llm_provider == "ollama":
            def _resolve() -> None:
                try:
                    resolve_ollama_model(settings)
                except Exception:
                    logger.exception("Background Ollama model resolution failed")

            loop = asyncio.get_running_loop()
            loop.run_in_executor(None, _resolve)
        yield

    app = FastAPI(
        title="Offline Notebook LM",
        version="0.1.0",
        description="Local-first API for chatting with local models (Ollama) with RAG support.",
        contact={"name": "Offline Notebook LM Team"},
        lifespan=lifespan,
    )

    # Bootstrap services
    embedding_backend = create_embedding_backend(settings)
    vector_store = create_vector_store(settings, embedding_backend)
    # Choose RAG engine based on settings (default to LlamaIndex if enabled)
    # Create both services, but use LlamaIndex as primary with custom RAG as fallback
    custom_rag_service = RAGService(settings, vector_store)
    if settings.use_llamaindex_rag:
        try:
            rag_service = LlamaIndexRAGService(settings, vector_store)
            # Store custom RAG as fallback in the service for error recovery
            rag_service._fallback_rag = custom_rag_service
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to initialize LlamaIndex RAG, falling back to custom RAG: {e}")
            rag_service = custom_rag_service
    else:
        rag_service = custom_rag_service
    
    app.state.settings = settings
    notebook_store = NotebookStore(settings)
    metrics_store = MetricsStore(settings)
    agent_service = AgentService(settings)

    conversation_store = ConversationStore(settings)
    app.state.conversation_store = conversation_store

    app.state.chat_service = ChatService(
        create_llm_backend(settings),
        settings,
        rag_service=rag_service,
        metrics_store=metrics_store,
    )
    app.state.ingestion_service = IngestionService(settings, vector_store)
    app.state.rag_service = rag_service
    app.state.vector_store = vector_store
    app.state.notebook_store = notebook_store
    app.state.metrics_store = metrics_store
    app.state.speech_service = SpeechService(settings)
    app.state.agent_service = agent_service

    # Explicit localhost dev origins + Electron's file:// origin ("null").
    # We used to allow_origin_regex=".*" with credentials — a localhost CSRF
    # footgun (any browser tab on the machine could hit the API). Credentials
    # aren't used, so leave them off.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "null",  # Electron file:// origin
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(documents.router, prefix="/api")
    app.include_router(rag.router, prefix="/api")
    app.include_router(notebooks.router, prefix="/api")
    app.include_router(metrics.router, prefix="/api")
    app.include_router(speech.router, prefix="/api")
    app.include_router(export.router, prefix="/api")
    app.include_router(agent.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    app.include_router(zotero.router, prefix="/api")

    @app.get("/api/config", tags=["config"])
    async def read_config() -> dict[str, object]:
        return {
            "llm_provider": settings.llm_provider,
            "ollama_model": settings.ollama_model,
            "resolved_ollama_model": settings.resolved_ollama_model or settings.ollama_model,
            "model_selection_reason": settings.model_selection_reason,
            "ollama_base_url": settings.ollama_base_url,
            "use_langchain_splitter": settings.use_langchain_splitter,
            "use_llamaindex_rag": settings.use_llamaindex_rag,
            "embedding_model": settings.embedding_model,
            "enable_speech_stt": settings.enable_speech_stt,
            "enable_speech_tts": settings.enable_speech_tts,
        }

    return app
