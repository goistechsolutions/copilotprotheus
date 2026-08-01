"""Modelos SQLAlchemy para o CopilotProtheus.

Este arquivo define todas as tabelas do banco de dados.
Para gerar uma nova migration após alterar modelos:
    alembic revision --autogenerate -m "descricao"
    alembic upgrade head
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base declarativa com campos de auditoria automáticos."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# TENANT REGISTRY
# ─────────────────────────────────────────────────────────────────────────────

class TenantRegistry(Base):
    """Registro de tenants (empresas) da plataforma."""

    __tablename__ = "tenant_registry"
    __table_args__ = (
        UniqueConstraint("tenant_code", name="uq_tenant_code"),
        UniqueConstraint("schema_name", name="uq_schema_name"),
        {"schema": "public"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_code: Mapped[str] = mapped_column(String(64), nullable=False)
    tenant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    schema_name: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    plan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("public.plans.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )

    plan: Mapped["Plan"] = relationship("Plan", back_populates="tenants")
    users: Mapped[list["User"]] = relationship("User", back_populates="tenant")


# ─────────────────────────────────────────────────────────────────────────────
# PLANS
# ─────────────────────────────────────────────────────────────────────────────

class Plan(Base):
    """Planos de assinatura da plataforma."""

    __tablename__ = "plans"
    __table_args__ = (
        UniqueConstraint("plan_code", name="uq_plans_plan_code"),
        {"schema": "public"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_code: Mapped[str] = mapped_column(String(32), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(128), nullable=False)
    max_users: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_queries_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    modules_allowed: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    price_brl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tenants: Mapped[list["TenantRegistry"]] = relationship(
        "TenantRegistry", back_populates="plan"
    )


# ─────────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    """Usuários da plataforma — vinculados a um tenant."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        {"schema": "public"},
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("public.tenant_registry.id", ondelete="CASCADE"),
        nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["TenantRegistry"] = relationship(
        "TenantRegistry", back_populates="users"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="user"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )


# ─────────────────────────────────────────────────────────────────────────────
# PROTHEUS MODULES MASTER
# ─────────────────────────────────────────────────────────────────────────────

class ProtheusModuleMaster(Base):
    """Catálogo de módulos Protheus disponíveis na plataforma."""

    __tablename__ = "protheus_modules_master"
    __table_args__ = (
        UniqueConstraint("module_code", name="uq_protheus_module_code"),
        {"schema": "public"},
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    module_code: Mapped[str] = mapped_column(String(8), nullable=False)
    module_name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Tabelas principais do módulo conforme dicionário Protheus
    # Ex: SIGAFAT -> ["SF1","SF2","SD1","SD2","SC5","SC6"]
    main_tables: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ─────────────────────────────────────────────────────────────────────────────
# CONVERSATIONS
# ─────────────────────────────────────────────────────────────────────────────

class Conversation(Base):
    """Sessão de conversa do usuário com o agente."""

    __tablename__ = "conversations"
    __table_args__ = {"schema": "public"}

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Módulo Protheus contexto: SIGAFAT, SIGAEST, SIGAFIN...
    module_context: Mapped[str | None] = mapped_column(String(8), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGES
# ─────────────────────────────────────────────────────────────────────────────

class Message(Base):
    """Mensagem individual dentro de uma conversa."""

    __tablename__ = "messages"
    __table_args__ = {"schema": "public"}

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("public.conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Tokens consumidos nesta mensagem
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Tabelas Protheus referenciadas na resposta (ex: ["SE1", "SE2"])
    protheus_tables_referenced: Mapped[list] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────────────────────────────────────

class AuditLog(Base):
    """Log de auditoria de ações críticas na plataforma."""

    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "public"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="audit_logs")
