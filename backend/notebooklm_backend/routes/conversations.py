from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..services.conversation_store import ConversationStore

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateConversationRequest(BaseModel):
    notebook_id: str
    title: str | None = None


class UpdateConversationRequest(BaseModel):
    title: str


class ConversationResponse(BaseModel):
    id: str
    notebook_id: str
    title: str | None
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources: list[dict] | None = None
    created_at: str


def _conv_to_response(conv) -> ConversationResponse:
    return ConversationResponse(
        id=conv.id,
        notebook_id=conv.notebook_id,
        title=conv.title,
        created_at=conv.created_at.isoformat() if conv.created_at else "",
        updated_at=conv.updated_at.isoformat() if conv.updated_at else "",
    )


def _msg_to_response(msg) -> MessageResponse:
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        sources=msg.sources,
        created_at=msg.created_at.isoformat() if msg.created_at else "",
    )


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    request: Request, body: CreateConversationRequest
) -> ConversationResponse:
    store: ConversationStore = request.app.state.conversation_store
    conv = store.create_conversation(
        notebook_id=body.notebook_id,
        title=body.title,
    )
    return _conv_to_response(conv)


@router.get("/", response_model=list[ConversationResponse])
async def list_conversations(
    request: Request, notebook_id: str
) -> list[ConversationResponse]:
    store: ConversationStore = request.app.state.conversation_store
    convs = store.list_conversations(notebook_id)
    return [_conv_to_response(c) for c in convs]


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    request: Request, conversation_id: str
) -> list[MessageResponse]:
    store: ConversationStore = request.app.state.conversation_store
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = store.list_messages(conversation_id)
    return [_msg_to_response(m) for m in msgs]


@router.delete("/{conversation_id}")
async def delete_conversation(
    request: Request, conversation_id: str
) -> dict[str, str]:
    store: ConversationStore = request.app.state.conversation_store
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    store.delete_conversation(conversation_id)
    return {"status": "deleted", "conversation_id": conversation_id}


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    request: Request,
    conversation_id: str,
    body: UpdateConversationRequest,
) -> ConversationResponse:
    store: ConversationStore = request.app.state.conversation_store
    conv = store.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    store.update_title(conversation_id, body.title)
    updated = store.get_conversation(conversation_id)
    return _conv_to_response(updated)
