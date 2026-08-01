"""Endpoints de chat — conversar com o agente CopilotProtheus."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Conversation, Message, User
from app.db.session import get_db
from app.routers.auth import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse, ConversationOut
from app.services.protheus_context import build_system_prompt

router = APIRouter()
client = AsyncOpenAI(api_key=settings.openai_api_key)


@router.post("/", response_model=ChatResponse, summary="Enviar mensagem ao agente")
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Busca ou cria conversa
    if payload.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == payload.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversa não encontrada",
            )
    else:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            module_context=payload.module_context,
            title=payload.message[:60],
        )
        db.add(conversation)
        await db.flush()

    # Busca histórico recente (últimas 10 mensagens)
    hist_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    history = list(reversed(hist_result.scalars().all()))

    # Monta mensagens para OpenAI
    system_prompt = build_system_prompt(module_context=payload.module_context)
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": payload.message})

    # Chama OpenAI
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        max_tokens=settings.openai_max_tokens,
        temperature=settings.openai_temperature,
    )
    assistant_content = response.choices[0].message.content
    tokens_used = response.usage.total_tokens if response.usage else 0

    # Salva mensagem do usuário
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
        tokens_used=0,
    )
    db.add(user_msg)

    # Salva resposta do assistente
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_content,
        tokens_used=tokens_used,
    )
    db.add(assistant_msg)
    await db.commit()

    return ChatResponse(
        conversation_id=conversation.id,
        message=assistant_content,
        tokens_used=tokens_used,
        created_at=datetime.now(timezone.utc),
    )


@router.get("/conversations", response_model=list[ConversationOut],
            summary="Listar conversas do usuário")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    return result.scalars().all()
