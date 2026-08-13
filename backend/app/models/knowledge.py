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

class TenantModuleContract(GlobalBase):
    """Corresponde a public.tenant_module_contracts"""
    __tablename__ = "tenant_module_contracts"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey("public.protheus_modules_master.id"), nullable=False)
    status = Column(String(20), nullable=False, default="allowed")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

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

class AgentQueryAuditGlobal(GlobalBase):
    """
    Corresponde a public.agent_query_audit (visão consolidada de plataforma).
    Nao confundir com AgentQueryAudit (tenant), abaixo, que vive em cada
    schema de tenant e é a que os serviços usam por padrão via search_path.
    """
    __tablename__ = "agent_query_audit"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    company_id = Column(Integer)
    env_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True))
    contract_id = Column(UUID(as_uuid=True))
    snapshot_id = Column(UUID(as_uuid=True))
    request_id = Column(String(120))
    natural_language_prompt = Column(Text)
    generated_sql = Column(Text)
    sql_hash = Column(String(128), index=True)
    execution_status = Column(String(20), nullable=False, default="planned")
    rows_returned = Column(Integer)
    response_time_ms = Column(Integer)
    blocked_reason = Column(String(255))
    tables_used = Column(Text)
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

class AgentUser(TenantBase):
    """Corresponde a public.agent_users (compatibilidade legada)"""
    __tablename__ = "agent_users"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True)
    email = Column(String(180))
    full_name = Column(String(180))
    password_hash = Column(String(255))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class AgentRole(TenantBase):
    """Corresponde a public.agent_roles (compatibilidade legada)"""
    __tablename__ = "agent_roles"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True)
    role_code = Column(String(60))
    role_name = Column(String(120))
    scope_level = Column(String(30))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class TenantAllowedTable(TenantBase):
    """
    Corresponde a public.tenant_allowed_tables.
    Controla quais tabelas do dicionário Protheus cada tenant tem permissão
    de consultar via agente (whitelist por tenant).
    FIX: __table_args__ unificado em tupla única (era duplicado, causava ImportError).
    """
    __tablename__ = "tenant_allowed_tables"
    __table_args__ = (
        UniqueConstraint("tenant_id", "table_name", name="uq_tenant_allowed_table"),
        {"schema": "public", "extend_existing": True},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    table_name = Column(String(30), nullable=False, index=True)
    module_code = Column(String(30))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class TenantAllowedField(TenantBase):
    """
    Controla quais campos de tabelas do dicionário Protheus cada tenant tem permissão
    de consultar via agente.
    """
    __tablename__ = "tenant_allowed_fields"
    __table_args__ = (
        UniqueConstraint("tenant_id", "table_name", "field_name", name="uq_tenant_allowed_field"),
        {"schema": "public", "extend_existing": True},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    table_name = Column(String(30), nullable=False, index=True)
    field_name = Column(String(30), nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

class TenantDictionaryTable(TenantBase):
    """
    Corresponde a "<tenant>".tenant_dictionary_tables.
    Tabela de catálogo de tabelas do dicionário por tenant/snapshot,
    usada para controle de importação e exibição no admin.
    """
    __tablename__ = "tenant_dictionary_tables"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    table_name = Column(String(30), nullable=False, index=True)
    table_alias = Column(String(80))
    module_code = Column(String(10))
    description = Column(Text)
    physical_name = Column(String(80))
    active_flag = Column(Boolean, nullable=False, default=True)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class TenantSchema(TenantBase):
    """Corresponde a \"<tenant>\".tenant_schemas"""
    __tablename__ = "tenant_schemas"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    modulo = Column(String(50), nullable=False, index=True)
    codmod = Column(String(50), index=True)
    chave = Column(String(10), nullable=False, index=True)
    tabela = Column(String(50))
    nome = Column(String(255))
    schema_json = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class DictionaryTable(TenantBase):
    """Corresponde a \"<tenant>\".dictionary_tables"""
    __tablename__ = "dictionary_tables"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    table_name = Column(String(30), nullable=False)
    table_alias = Column(String(80))
    module_code = Column(String(10))
    description = Column(Text)
    physical_name = Column(String(80))
    active_flag = Column(Boolean, nullable=False, default=True)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class DictionaryField(TenantBase):
    """Corresponde a \"<tenant>\".dictionary_fields"""
    __tablename__ = "dictionary_fields"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    table_name = Column(String(30), nullable=False)
    field_name = Column(String(30), nullable=False)
    title = Column(String(120))
    field_type = Column(String(5))
    length_num = Column(Integer)
    decimal_num = Column(Integer)
    required_flag = Column(Boolean, nullable=False, default=False)
    browse_flag = Column(Boolean, nullable=False, default=False)
    virtual_flag = Column(Boolean, nullable=False, default=False)
    validation_rule = Column(Text)
    relation_rule = Column(Text)
    when_rule = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class DictionaryIndex(TenantBase):
    """Corresponde a \"<tenant>\".dictionary_indexes"""
    __tablename__ = "dictionary_indexes"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    table_name = Column(String(30), nullable=False)
    index_order = Column(String(10), nullable=False)
    nickname = Column(String(80))
    expression = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class DictionaryGroup(TenantBase):
    """Corresponde a \"<tenant>\".dictionary_groups"""
    __tablename__ = "dictionary_groups"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    group_name = Column(String(80), nullable=False)
    description = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class TenantDictionarySource(TenantBase):
    """Corresponde a \"<tenant>\".tenant_dictionary_sources"""
    __tablename__ = "tenant_dictionary_sources"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    source_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    started_at = Column(TIMESTAMP(timezone=True))
    finished_at = Column(TIMESTAMP(timezone=True))
    error_message = Column(Text)

class TenantTablePermission(TenantBase):
    """Corresponde a \"<tenant>\".tenant_table_permissions"""
    __tablename__ = "tenant_table_permissions"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    role_id = Column(String(100), nullable=False)
    table_name = Column(String(30), nullable=False)
    can_list = Column(Boolean, nullable=False, default=False)
    can_describe = Column(Boolean, nullable=False, default=False)
    can_query = Column(Boolean, nullable=False, default=False)
    approved_by = Column(String(100))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class TenantFieldPermission(TenantBase):
    """Corresponde a \"<tenant>\".tenant_field_permissions"""
    __tablename__ = "tenant_field_permissions"
    __table_args__ = {"extend_existing": True}

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    role_id = Column(String(100), nullable=False)
    table_name = Column(String(30), nullable=False)
    field_name = Column(String(30), nullable=False)
    can_select = Column(Boolean, nullable=False, default=False)
    can_filter = Column(Boolean, nullable=False, default=False)
    masked_flag = Column(Boolean, nullable=False, default=False)
    approved_by = Column(String(100))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

