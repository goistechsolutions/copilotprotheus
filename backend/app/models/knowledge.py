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
    """Corresponde a public.tenant"""
    __tablename__ = "tenant"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(Integer, primary_key=True)
    tenant_code = Column(String(50), unique=True, nullable=False)
    tenant_name = Column(String(150), nullable=False)
    schema_name = Column(String(63), unique=True, nullable=False)
    cnpj = Column(String(20))
    webapp_url = Column(Text)
    apirest_url = Column(Text)
    protheus_user = Column(String(100))
    encrypted_protheus_password = Column(String(255))
    protheus_ambientes = Column(String(100), default=" ")
    status = Column(String(20), nullable=False, default="provisioning")
    system_prompt = Column(Text)
    temperature = Column(Numeric(3, 2), default=0.20)
    licenca_uso = Column(Text)
    plan_code = Column(String(50))
    contract_info = Column(JSONB)
    api_access_info = Column(JSONB)
    version = Column(String(50))
    agent_permissions = Column(JSONB)
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
    tenant_id = Column(String(100), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey('public.roles.id'))
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












# RESTORED V4 CLASSES

class RolePermission(GlobalBase):
    """Corresponde a public.role_permissions"""
    __tablename__ = "role_permissions"
    __table_args__ = {"schema": "public", "extend_existing": True}

    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("public.permissions.id", ondelete="CASCADE"), primary_key=True)

class UserRole(GlobalBase):
    """Corresponde a public.user_roles (ORM model — use a table `user_roles` para many-to-many)"""
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "public", "extend_existing": True}

    user_id = Column(UUID(as_uuid=True), primary_key=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.id", ondelete="CASCADE"), primary_key=True)
    tenant_id = Column(String(100), primary_key=True)
    company_id = Column(Integer, primary_key=True)

class UserCompanyAccess(GlobalBase):
    """Corresponde a public.user_company_access"""
    __tablename__ = "user_company_access"
    __table_args__ = {"schema": "public", "extend_existing": True}

    user_id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(String(100), primary_key=True)
    company_id = Column(Integer, primary_key=True)
    env_id = Column(UUID(as_uuid=True))

class Environment(GlobalBase):
    """Corresponde a public.environments"""
    __tablename__ = "environments"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    company_id = Column(Integer, index=True)
    env_code = Column(String(60), nullable=False)
    env_name = Column(String(120), nullable=False)
    api_base_url = Column(String(500))
    middleware_route = Column(String(500))
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class Connector(GlobalBase):
    """Corresponde a public.connectors"""
    __tablename__ = "connectors"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    company_id = Column(Integer, index=True)
    env_id = Column(UUID(as_uuid=True), index=True)
    connector_type = Column(String(50), nullable=False)
    connector_name = Column(String(150), nullable=False)
    base_url = Column(String(500))
    auth_type = Column(String(50))
    secret_ref = Column(String(200))
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class LicensePlan(GlobalBase):
    """Corresponde a public.license_plans"""
    __tablename__ = "license_plans"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(60), nullable=False, unique=True)
    plan_name = Column(String(150), nullable=False)
    billing_cycle = Column(String(20), nullable=False, default="monthly")
    query_limit = Column(Integer)
    concurrent_sessions_limit = Column(Integer)
    overage_mode = Column(String(20), nullable=False, default="block")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class TenantContract(GlobalBase):
    """Corresponde a public.tenant_contracts"""
    __tablename__ = "tenant_contracts"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("public.license_plans.id"))
    contract_code = Column(String(80), nullable=False, unique=True)
    contract_status = Column(String(20), nullable=False, default="active")
    starts_at = Column(DATE, nullable=False)
    ends_at = Column(DATE)
    query_limit_override = Column(Integer)
    concurrent_sessions_override = Column(Integer)
    overage_mode_override = Column(String(20))
    notes = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class QueryUsageCounter(GlobalBase):
    """Corresponde a public.query_usage_counters"""
    __tablename__ = "query_usage_counters"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), nullable=False)
    period_ref = Column(String(20), nullable=False)
    total_queries = Column(Integer, nullable=False, default=0)
    blocked_queries = Column(Integer, nullable=False, default=0)
    overage_queries = Column(Integer, nullable=False, default=0)
    updated_at = Column(TIMESTAMP(timezone=True))

class ConcurrentSession(GlobalBase):
    """Corresponde a public.concurrent_sessions"""
    __tablename__ = "concurrent_sessions"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True))
    session_key = Column(String(120), nullable=False, unique=True)
    started_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    expires_at = Column(TIMESTAMP(timezone=True))
    session_status = Column(String(20), nullable=False, default="active")


class AuditLog(GlobalBase):
    """Corresponde a public.audit_logs (auditoria global de plataforma)"""
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True)
    company_id = Column(Integer, index=True)
    user_id = Column(String(100))
    module_name = Column(String(80), nullable=False)
    action_name = Column(String(120), nullable=False)
    target_type = Column(String(80))
    target_id = Column(String(120))
    request_id = Column(String(120))
    details_json = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Memory(TenantBase):
    """Corresponde a \"<tenant>\".memories"""
    __tablename__ = "memories"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    tenant_id = Column(String(100), nullable=False, default="default")
    company_id = Column(Integer)
    visibility = Column(String(20), nullable=False, default="tenant")
    memory_key = Column(String(255), nullable=False)
    memory_value = Column(Text, nullable=False)
    memory_type = Column(String(50))
    scope = Column(String(100))
    tags = Column(JSONB)
    confidence = Column(Integer)
    source = Column(String(255))
    expires_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class Document(TenantBase):
    """Corresponde a \"<tenant>\".documents"""
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    tenant_id = Column(String(100), nullable=False, default="default")
    visibility = Column(String(20), nullable=False, default="tenant")
    title = Column(String(255), nullable=False)
    source_path = Column(String(1024), nullable=False)
    source_type = Column(String(50))
    module = Column(String(100))
    category = Column(String(100))
    version = Column(String(50))
    status = Column(String(50))
    checksum = Column(String(64))
    language = Column(String(10))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
    )

class DocumentChunk(TenantBase):
    """Corresponde a \"<tenant>\".document_chunks"""
    __tablename__ = "document_chunks"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_order = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer)
    embedding_model = Column(String(100))
    page_number = Column(Integer)
    section = Column(String(255))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")

class AgentQueryAudit(GlobalBase):
    """
    Corresponde a \"<tenant>\".agent_query_audit (auditoria operacional
    por tenant, é a tabela usada no dia a dia pelos serviços via
    search_path). Não confundir com AgentQueryAuditGlobal (public).
    """
    __tablename__ = "agent_query_audit"
    __table_args__ = {"extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(Integer)
    env_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True))
    contract_id = Column(UUID(as_uuid=True))
    snapshot_id = Column(UUID(as_uuid=True))
    request_id = Column(String(120))
    natural_language_prompt = Column(Text)
    generated_sql = Column(Text)
    sql_hash = Column(String(128))
    execution_status = Column(String(20), nullable=False, default="planned")
    rows_returned = Column(Integer)
    response_time_ms = Column(Integer)
    blocked_reason = Column(String(255))
    tables_used = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())



# RESTORED DEPRECATED V4 CLASSES (For backward compatibility)
















class DictionaryTable(TenantBase):
    __tablename__ = "dictionary_tables"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("company_info.id", ondelete="CASCADE"), nullable=True)
    table_code = Column(String(10), nullable=False)
    table_name = Column(String(50), nullable=False)
    module_code = Column(String(10))
    description = Column(String(255))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

class DictionaryField(TenantBase):
    __tablename__ = "dictionary_fields"
    id = Column(Integer, primary_key=True, index=True)
    table_code = Column(String(10), nullable=False)
    field_name = Column(String(50), nullable=False)
    title = Column(String(100))
    field_type = Column(String(1))
    length_num = Column(Integer)
    decimal_num = Column(Integer)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

class DictionaryIndex(TenantBase):
    __tablename__ = "dictionary_indexes"
    id = Column(Integer, primary_key=True, index=True)
    table_code = Column(String(10), nullable=False)
    index_order = Column(Integer, nullable=False)
    nickname = Column(String(100))
    expression = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
