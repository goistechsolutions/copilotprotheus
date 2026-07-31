"""
backend/app/models/knowledge.py

Copilot Protheus - Models SQLAlchemy (V4 - Multi-tenant via Schemas PostgreSQL)

Este arquivo reconcilia os modelos ORM com o DDL efetivamente criado por
`backend/app/db/database.py`:

- Modelos GLOBAIS (existem fisicamente em `public`) usam
  `__table_args__ = {'schema': 'public'}` de forma explícita.
- Modelos de TENANT (existem em schemas dinâmicos, um por empresa/tenant,
  ex: "acme", "contoso") NÃO declaram schema fixo. A resolução do schema
  correto ocorre em runtime via `SET search_path TO "<tenant>", public`,
  feito em `get_db()` / `get_tenant_session()` antes de qualquer query.

IMPORTANTE:
- Nunca adicione `schema=` fixo em modelos de tenant. Isso quebraria o
  isolamento multi-tenant, pois o SQLAlchemy passaria a apontar sempre
  para um schema literal em vez de respeitar o `search_path` da sessão.
- Toda tabela abaixo tem correspondência 1:1 com o DDL em `database.py`.
  Se uma tabela for renomeada ou remover uma coluna lá, este arquivo
  precisa ser atualizado no mesmo commit.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, Text, TIMESTAMP, DATE,
    ForeignKey, Numeric, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


# ═══════════════════════════════════════════════════════════════
# MODELOS GLOBAIS — schema `public`
# ═══════════════════════════════════════════════════════════════

class Tenant(Base):
    """Corresponde a public.tenant_registry"""
    __tablename__ = "tenant_registry"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    tenant_code = Column(String(50), unique=True, nullable=False)
    tenant_name = Column(String(150), nullable=False)
    schema_name = Column(String(63), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="provisioning")
    plan_code = Column(String(50))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now())
    provisioned_at = Column(TIMESTAMP)
    decommissioned_at = Column(TIMESTAMP)


class Plan(Base):
    """Corresponde a public.plans"""
    __tablename__ = "plans"
    __table_args__ = {"schema": "public"}

    plan_code = Column(String(50), primary_key=True)
    plan_name = Column(String(150), nullable=False)
    max_users = Column(Integer, default=5)
    max_queries_day = Column(Integer, default=500)
    modules_allowed = Column(JSONB, default=list)
    active = Column(Boolean, default=True)


class PlatformAdmin(Base):
    """Corresponde a public.platform_admins"""
    __tablename__ = "platform_admins"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_superadmin = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class ProtheusModuleMaster(Base):
    """Corresponde a public.protheus_modules_master"""
    __tablename__ = "protheus_modules_master"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mod_code = Column(String(30), unique=True)
    module_code = Column(String(30), unique=True)
    mod_name = Column(String(150))
    module_name = Column(String(150))
    description = Column(Text)
    source_name = Column(String(60), nullable=False, default="SYS_USR_MODULE")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))


class User(Base):
    """Corresponde a public.users"""
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True)
    email = Column(String(180), nullable=False, unique=True)
    full_name = Column(String(180), nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    is_platform_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))


class Role(Base):
    """Corresponde a public.roles"""
    __tablename__ = "roles"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_code = Column(String(60), nullable=False, unique=True)
    role_name = Column(String(120), nullable=False)
    scope_level = Column(String(30), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Permission(Base):
    """Corresponde a public.permissions"""
    __tablename__ = "permissions"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    permission_code = Column(String(100), nullable=False, unique=True)
    permission_name = Column(String(150), nullable=False)
    module_name = Column(String(80), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class RolePermission(Base):
    """Corresponde a public.role_permissions"""
    __tablename__ = "role_permissions"
    __table_args__ = {"schema": "public"}

    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("public.permissions.id", ondelete="CASCADE"), primary_key=True)


class UserRole(Base):
    """Corresponde a public.user_roles"""
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), primary_key=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("public.roles.id", ondelete="CASCADE"), primary_key=True)
    tenant_id = Column(String(100), primary_key=True)
    company_id = Column(Integer, primary_key=True)


class UserCompanyAccess(Base):
    """Corresponde a public.user_company_access"""
    __tablename__ = "user_company_access"
    __table_args__ = {"schema": "public"}

    user_id = Column(UUID(as_uuid=True), primary_key=True)
    tenant_id = Column(String(100), primary_key=True)
    company_id = Column(Integer, primary_key=True)
    env_id = Column(UUID(as_uuid=True))


class Environment(Base):
    """Corresponde a public.environments"""
    __tablename__ = "environments"
    __table_args__ = {"schema": "public"}

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


class Connector(Base):
    """Corresponde a public.connectors"""
    __tablename__ = "connectors"
    __table_args__ = {"schema": "public"}

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


class LicensePlan(Base):
    """Corresponde a public.license_plans"""
    __tablename__ = "license_plans"
    __table_args__ = {"schema": "public"}

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


class TenantContract(Base):
    """Corresponde a public.tenant_contracts"""
    __tablename__ = "tenant_contracts"
    __table_args__ = {"schema": "public"}

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


class QueryUsageCounter(Base):
    """Corresponde a public.query_usage_counters"""
    __tablename__ = "query_usage_counters"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), nullable=False)
    period_ref = Column(String(20), nullable=False)
    total_queries = Column(Integer, nullable=False, default=0)
    blocked_queries = Column(Integer, nullable=False, default=0)
    overage_queries = Column(Integer, nullable=False, default=0)
    updated_at = Column(TIMESTAMP(timezone=True))


class ConcurrentSession(Base):
    """Corresponde a public.concurrent_sessions"""
    __tablename__ = "concurrent_sessions"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True))
    session_key = Column(String(120), nullable=False, unique=True)
    started_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    expires_at = Column(TIMESTAMP(timezone=True))
    session_status = Column(String(20), nullable=False, default="active")


class TenantModuleContract(Base):
    """Corresponde a public.tenant_module_contracts"""
    __tablename__ = "tenant_module_contracts"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey("public.protheus_modules_master.id"), nullable=False)
    status = Column(String(20), nullable=False, default="allowed")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Corresponde a public.audit_logs (auditoria global de plataforma)"""
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "public"}

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


class AgentUser(Base):
    """Corresponde a public.agent_users (compatibilidade legada)"""
    __tablename__ = "agent_users"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True)
    email = Column(String(180))
    full_name = Column(String(180))
    password_hash = Column(String(255))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))


class AgentRole(Base):
    """Corresponde a public.agent_roles (compatibilidade legada)"""
    __tablename__ = "agent_roles"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True)
    role_code = Column(String(60))
    role_name = Column(String(120))
    scope_level = Column(String(30))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AgentQueryAuditGlobal(Base):
    """
    Corresponde a public.agent_query_audit (visão consolidada de plataforma).
    Nao confundir com AgentQueryAudit (tenant), abaixo, que vive em cada
    schema de tenant e é a que os serviços usam por padrão via search_path.
    """
    __tablename__ = "agent_query_audit"
    __table_args__ = {"schema": "public"}

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


class PlatformAuditLog(Base):
    """Corresponde a public.platform_audit_log"""
    __tablename__ = "platform_audit_log"
    __table_args__ = {"schema": "public"}

    id = Column(BigInteger, primary_key=True)
    tenant_code = Column(String(50))
    actor = Column(String(150))
    action = Column(String(100), nullable=False)
    detail = Column(JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())


# ═══════════════════════════════════════════════════════════════
# MODELOS DE TENANT — schema dinâmico (resolvido via search_path)
#
# ATENÇÃO: NENHUMA classe abaixo declara __table_args__ com schema
# fixo. O isolamento por tenant depende exclusivamente do
# `SET search_path TO "<tenant>", public` executado em
# get_db()/get_tenant_session() antes de qualquer query ORM.
# ═══════════════════════════════════════════════════════════════

class Company(Base):
    """Corresponde a "<tenant>".company_info"""
    __tablename__ = "company_info"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(String(100))
    company_code = Column(String(60), nullable=False)
    branch_code = Column(String(60), nullable=False)
    company_name = Column(String(200), nullable=False)
    cnpj = Column(String(30))
    ie = Column(String(30))
    razao_social = Column(String(255))
    email = Column(String(255))
    telefone = Column(String(50))
    endereco = Column(String(500))
    protheus_grupo = Column(String(20))
    protheus_empresa = Column(String(20))
    protheus_unidade = Column(String(20))
    protheus_filial = Column(String(30))
    environment = Column(String(60), default="producao")
    protheus_ambientes = Column(String(100), default="producao")
    webapp_url = Column(Text)
    protheus_rest_url = Column(Text)
    protheus_usuario = Column(String(100))
    encrypted_protheus_password = Column(Text)
    auth_mode = Column(String(30), default="basic")
    status = Column(String(20), default="active")
    system_prompt = Column(Text)
    temperature = Column(Numeric(3, 2), default=0.20)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_code", "branch_code", name="uq_company_info_code_branch"),
    )


class ProtheusModule(Base):
    """Corresponde a "<tenant>".protheus_modules"""
    __tablename__ = "protheus_modules"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    company_code = Column(String(60))
    modulo = Column(String(50), nullable=False, index=True)
    codmod = Column(String(50), nullable=False, index=True)
    usr_modulo = Column(String(50))
    usr_codmod = Column(String(50))
    usr_nome = Column(String(255))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TenantSchema(Base):
    """Corresponde a "<tenant>".tenant_schemas"""
    __tablename__ = "tenant_schemas"

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


class DictionaryTable(Base):
    """Corresponde a "<tenant>".dictionary_tables"""
    __tablename__ = "dictionary_tables"

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    snapshot_code = Column(String(60), nullable=False)
    table_name = Column(String(30), nullable=False)
    table_alias = Column(String(80))
    module_code = Column(String(10))
    description = Column(Text)
    physical_name = Column(String(80))
    active_flag = Column(Boolean, nullable=False, default=True)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class DictionaryField(Base):
    """Corresponde a "<tenant>".dictionary_fields"""
    __tablename__ = "dictionary_fields"

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    snapshot_code = Column(String(60), nullable=False)
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


class DictionaryIndex(Base):
    """Corresponde a "<tenant>".dictionary_indexes"""
    __tablename__ = "dictionary_indexes"

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    snapshot_code = Column(String(60), nullable=False)
    table_name = Column(String(30), nullable=False)
    index_order = Column(String(10), nullable=False)
    nickname = Column(String(80))
    expression = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class DictionaryGroup(Base):
    """Corresponde a "<tenant>".dictionary_groups"""
    __tablename__ = "dictionary_groups"

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    snapshot_code = Column(String(60), nullable=False)
    group_name = Column(String(80), nullable=False)
    description = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TenantDictionarySource(Base):
    """Corresponde a "<tenant>".tenant_dictionary_sources"""
    __tablename__ = "tenant_dictionary_sources"

    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(String(100), nullable=False)
    company_id = Column(String(100))
    environment_id = Column(String(100), nullable=False, default="producao")
    source_type = Column(String(20), nullable=False)
    snapshot_code = Column(String(60), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    started_at = Column(TIMESTAMP(timezone=True))
    finished_at = Column(TIMESTAMP(timezone=True))
    error_message = Column(Text)


class TenantTablePermission(Base):
    """Corresponde a "<tenant>".tenant_table_permissions"""
    __tablename__ = "tenant_table_permissions"

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


class TenantFieldPermission(Base):
    """Corresponde a "<tenant>".tenant_field_permissions"""
    __tablename__ = "tenant_field_permissions"

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


class Memory(Base):
    """Corresponde a "<tenant>".memories"""
    __tablename__ = "memories"

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


class Document(Base):
    """Corresponde a "<tenant>".documents"""
    __tablename__ = "documents"

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


class DocumentChunk(Base):
    """Corresponde a "<tenant>".document_chunks"""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_order = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer)
    embedding_model = Column(String(100))
    # vector(3072) é criado via DDL raw em database.py (extensão pgvector).
    # Mantido fora do ORM tipado para evitar dependência rígida de
    # sqlalchemy-pgvector no model; leitura/escrita do embedding é feita
    # via SQL raw em rag_service.py.
    page_number = Column(Integer)
    section = Column(String(255))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")


class AgentQueryAudit(Base):
    """
    Corresponde a "<tenant>".agent_query_audit (auditoria operacional
    por tenant, é a tabela usada no dia a dia pelos serviços via
    search_path). Não confundir com AgentQueryAuditGlobal (public).
    """
    __tablename__ = "agent_query_audit"

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
