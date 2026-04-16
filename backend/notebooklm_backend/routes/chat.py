from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..models.chat import ChatRequest, ChatResponse
from ..services.chat import ChatService, ChatMessage
from ..services.conversation_store import ConversationStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: Request, payload: ChatRequest) -> ChatResponse:
    service: ChatService = request.app.state.chat_service
    history = None
    if payload.history:
        history = [ChatMessage(role=msg.role, content=msg.content) for msg in payload.history]
    try:
        result = await service.generate_reply(
            prompt=payload.prompt,
            history=history,
            notebook_id=payload.notebook_id,
        )
        return ChatResponse(reply=result.reply, provider=service.provider, metrics=result.metrics)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/stream")
async def chat_stream_endpoint(request: Request, payload: ChatRequest) -> StreamingResponse:
    service: ChatService = request.app.state.chat_service
    conv_store: ConversationStore = request.app.state.conversation_store
    history = None
    if payload.history:
        history = [ChatMessage(role=msg.role, content=msg.content) for msg in payload.history]

    async def event_generator():
        accumulated_reply = ""
        sources_data: list[dict] | None = None
        conversation_id = payload.conversation_id
        persist_warning = False

        try:
            # Create conversation on first message if no conversation_id provided
            if conversation_id is None and payload.notebook_id:
                try:
                    conv = conv_store.create_conversation(
                        notebook_id=payload.notebook_id,
                    )
                    conversation_id = conv.id
                    conv_store.auto_title_if_needed(conversation_id, payload.prompt)
                except Exception:
                    logger.warning("Failed to create conversation", exc_info=True)

            # Persist user message
            if conversation_id:
                try:
                    conv_store.add_message(
                        conversation_id=conversation_id,
                        role="user",
                        content=payload.prompt,
                    )
                except Exception:
                    logger.warning("Failed to persist user message", exc_info=True)

            async for event in service.stream_reply(
                prompt=payload.prompt,
                history=history,
                notebook_id=payload.notebook_id,
                notebook_ids=payload.notebook_ids,
            ):
                if event.get("type") == "meta":
                    sources_data = event.get("sources")
                elif event.get("type") == "token":
                    accumulated_reply += event.get("delta", "")
                elif event.get("type") == "done":
                    accumulated_reply = event.get("reply", accumulated_reply)

                # Inject conversation_id into meta events so frontend knows which conversation
                if event.get("type") == "meta" and conversation_id:
                    event["conversation_id"] = conversation_id

                yield f"data: {json.dumps(event)}\n\n"

        except Exception as e:
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            # Persist assistant response (handles both normal completion and disconnect)
            if conversation_id and accumulated_reply:
                try:
                    conv_store.add_message(
                        conversation_id=conversation_id,
                        role="assistant",
                        content=accumulated_reply,
                        sources=sources_data,
                    )
                except Exception:
                    logger.warning("Failed to persist assistant message", exc_info=True)
                    # Don't yield in finally: GeneratorExit is a BaseException, and
                    # yielding after it raises RuntimeError. Log server-side only.

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
