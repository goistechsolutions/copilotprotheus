"""
backend/app/models/knowledge.py

Copilot Protheus - Models SQLAlchemy (V5 - Multi-tenant via Schemas PostgreSQL)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, Text, TIMESTAMP, DATE,
    ForeignKey, Numeric, UniqueConstraint, Index, Table
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import GlobalBase, TenantBase


# ═══════════════════════════════════════════════════════════════
# MODELOS GLOBAIS — schema `public` (GlobalBase)
# ═══════════════════════════════════════════════════════════════

class Tenant(GlobalBase):
    """Corresponde a public.tenant_registry"""
    __tablename__ = "tenant_registry"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(Integer, primary_key=True)
    tenant_code = Column(String(50), unique=True, nullable=False)
    tenant_name = Column(String(150), nullable=False)
    schema_name = Column(String(63), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="provisioning")
    plan_code = Column(String(50))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    provisioned_at = Column(TIMESTAMP(timezone=True))
    decommissioned_at = Column(TIMESTAMP(timezone=True))


class Plan(GlobalBase):
    __tablename__ = "plans"
    __table_args__ = {"schema": "public", "extend_existing": True}

    plan_code = Column(String(50), primary_key=True)
    plan_name = Column(String(150), nullable=False)
    max_users = Column(Integer, default=5)
    max_queries_day = Column(Integer, default=500)
    modules_allowed = Column(JSONB, default=list)
    active = Column(Boolean, default=True)


class PlatformAdmin(GlobalBase):
    __tablename__ = "platform_admins"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(Integer, primary_key=True)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_superadmin = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class ProtheusModuleMaster(GlobalBase):
    __tablename__ = "protheus_modules_master"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mod_code = Column(Integer, nullable=False, unique=True)
    mod_sigla = Column(String(30), unique=True)
    mod_name = Column(String(150), nullable=False)
    description = Column(Text)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))


class User(GlobalBase):
    """Usuários do Painel Administrativo Global"""
    __tablename__ = "users"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(180), nullable=False, unique=True)
    full_name = Column(String(180), nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    is_platform_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))


class Role(GlobalBase):
    __tablename__ = "roles"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_code = Column(String(60), nullable=False, unique=True)
    role_name = Column(String(120), nullable=False)
    scope_level = Column(String(30), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Permission(GlobalBase):
    __tablename__ = "permissions"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    perm_code = Column(String(100), nullable=False, unique=True)
    description = Column(String(255))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class PlatformAuditLog(GlobalBase):
    __tablename__ = "platform_audit_log"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    admin_id = Column(Integer)
    action = Column(String(100), nullable=False)
    target_entity = Column(String(100))
    target_id = Column(String(100))
    details = Column(JSONB)
    ip_address = Column(String(45))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════════════════
# MODELOS DE TENANT — schema dinâmico (TenantBase)
# ═══════════════════════════════════════════════════════════════

class Company(TenantBase):
    """Corresponde a "<tenant>".company_info"""
    __tablename__ = "company_info"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    company_code = Column(String(60), nullable=False)
    branch_code = Column(String(60), nullable=False)
    company_name = Column(String(200), nullable=False)
    cnpj = Column(String(30))
    protheus_rest_url = Column(Text)
    protheus_usuario = Column(String(100))
    encrypted_protheus_password = Column(Text)
    status = Column(String(20), default="active")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_code", "branch_code", name="uq_company_info_code_branch"),
        {"extend_existing": True},
    )


class ProtheusModule(TenantBase):
    """Corresponde a "<tenant>".protheus_modules"""
    __tablename__ = "protheus_modules"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    mod_code = Column(Integer, nullable=False, index=True)
    mod_sigla = Column(String(50))
    mod_name = Column(String(100))
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TenantSchemaV5(TenantBase):
    """Corresponde a "<tenant>".tenant_schemas do V5"""
    __tablename__ = "tenant_schemas"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    mod_code = Column(Integer, index=True)
    mod_sigla = Column(String(30))
    chave = Column(String(10), index=True)
    tabela = Column(String(20), index=True)
    nome = Column(String(120))
    campo = Column(String(10), index=True)
    campo_titulo = Column(String(80))
    campo_tipo = Column(String(5))
    campo_tamanho = Column(Integer)
    campo_decimal = Column(Integer)
    campo_obrigatorio = Column(Boolean)
    campo_usado = Column(Boolean)
    campo_descricao = Column(Text)
    is_customizado = Column(Boolean)
    schema_json = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class FieldRule(TenantBase):
    """Corresponde a "<tenant>".field_rules do V5"""
    __tablename__ = "field_rules"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    tabela = Column(String(20), nullable=False)
    campo = Column(String(10), nullable=False)
    rule_description = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TenantUser(TenantBase):
    """Corresponde a "<tenant>".users do V5"""
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(180), nullable=False, unique=True)
    full_name = Column(String(180), nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class QueryAudit(TenantBase):
    """Corresponde a "<tenant>".query_audit do V5"""
    __tablename__ = "query_audit"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    natural_language_prompt = Column(Text)
    generated_sql = Column(Text)
    sql_hash = Column(String(128))
    execution_status = Column(String(20), nullable=False, default='planned')
    rows_returned = Column(Integer)
    response_time_ms = Column(Integer)
    blocked_reason = Column(String(255))
    tables_used = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
