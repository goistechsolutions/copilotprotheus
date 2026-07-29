"""Models canônicos V4 — copilot_protheus

Regras:
- Um único modelo por entidade. Sem duplicatas V2.
- PKs: tenants.id = String(100) slug; demais entidades = UUID.
- Senhas sempre criptografadas (encrypted_*). Nunca em claro.
- tenant_id presente em toda tabela de domínio.
- Indexes explícitos em colunas de busca frequente.
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
    JSON, Float, Boolean, Date, Table, Numeric, Index
)
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.db.database import Base
import uuid

# ─────────────────────────────────────────────────────────────
# TABELAS DE ASSOCIAÇÃO (Many-to-Many Globais em public)
# ─────────────────────────────────────────────────────────────

role_permissions = Table(
    'role_permissions', Base.metadata,
    Column('role_id',       UUID(as_uuid=True), ForeignKey('public.roles.id',       ondelete='CASCADE'), primary_key=True),
    Column('permission_id', UUID(as_uuid=True), ForeignKey('public.permissions.id', ondelete='CASCADE'), primary_key=True),
    schema='public'
)

user_company_access = Table(
    'user_company_access', Base.metadata,
    Column('user_id',    UUID(as_uuid=True), ForeignKey('public.users.id',        ondelete='CASCADE'), primary_key=True),
    Column('tenant_id',  String(100),        ForeignKey('public.tenants.id',      ondelete='CASCADE'), primary_key=True),
    Column('company_id', Integer,            ForeignKey('public.companies.id',    ondelete='CASCADE'), primary_key=True),
    Column('env_id',     UUID(as_uuid=True), ForeignKey('public.environments.id', ondelete='CASCADE')),
    schema='public'
)

user_roles = Table(
    'user_roles', Base.metadata,
    Column('user_id',    UUID(as_uuid=True), ForeignKey('public.users.id',     ondelete='CASCADE'), primary_key=True),
    Column('role_id',    UUID(as_uuid=True), ForeignKey('public.roles.id',     ondelete='CASCADE'), primary_key=True),
    Column('tenant_id',  String(100),        ForeignKey('public.tenants.id',   ondelete='CASCADE'), primary_key=True),
    Column('company_id', Integer,            ForeignKey('public.companies.id', ondelete='CASCADE'), primary_key=True),
    schema='public'
)

# ─────────────────────────────────────────────────────────────
# TENANT  (PK slug String — mantido por compatibilidade)
# ─────────────────────────────────────────────────────────────

class Tenant(Base):
    """Entidade raiz multi-tenant. PK = slug legível (ex: 'elitecorp')."""
    __tablename__ = 'tenants'
    __table_args__ = {'schema': 'public'}

    id                          = Column(String(100), primary_key=True, index=True)
    name                        = Column(String(255), nullable=True)
    tenant_code                 = Column(String(100), nullable=True, index=True)
    tenant_name                 = Column(String(255), nullable=True)
    protheus_rest_url           = Column(String(1024), nullable=True)
    protheus_user               = Column(String(255), nullable=True)
    encrypted_protheus_password = Column(Text, nullable=True)          # NUNCA devolver em GET
    auth_mode                   = Column(String(50),  server_default='basic')
    system_prompt               = Column(Text, nullable=True)
    temperature                 = Column(Float, server_default='0.2')  # padrão conservador
    status                      = Column(String(50),  server_default='active')
    plan_code                   = Column(String(50),  nullable=True)
    created_at                  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at                  = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# COMPANY
# ─────────────────────────────────────────────────────────────

class Company(Base):
    """Empresa/filial Protheus vinculada a um tenant."""
    __tablename__ = 'companies'
    __table_args__ = {'schema': 'public'}

    id                          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id                   = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    cnpj                        = Column(String(30),   index=True, nullable=True)
    ie                          = Column(String(30),   nullable=True)
    razao_social                = Column(String(255),  nullable=True)
    email                       = Column(String(255),  nullable=True)
    telefone                    = Column(String(50),   nullable=True)
    endereco                    = Column(String(500),  nullable=True)
    protheus_grupo              = Column(String(20),   nullable=True)
    protheus_empresa            = Column(String(20),   nullable=True)
    protheus_unidade            = Column(String(20),   nullable=True)
    protheus_filial             = Column(String(30),   nullable=True)
    protheus_ambientes          = Column(String(100),  server_default='producao')
    protheus_usuario            = Column(String(100),  nullable=True)
    encrypted_protheus_password = Column(Text,         nullable=True)  # senha criptografada
    protheus_rest_url           = Column(String(1024), nullable=True)
    protheus_webapp_url         = Column(String(1024), nullable=True)
    licenca_uso                 = Column(Text,         nullable=True)
    status                      = Column(String(50),   server_default='ativa')
    company_code                = Column(String(60),   nullable=True)
    company_name                = Column(String(200),  nullable=True)
    protheus_env                = Column(String(100),  nullable=True)
    protheus_branch             = Column(String(100),  nullable=True)
    created_at                  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at                  = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# RBAC — Users / Roles / Permissions  (MODELO ÚNICO)
# ─────────────────────────────────────────────────────────────

class User(Base):
    """Usuário da plataforma. Substitui AgentUser (V2 removido)."""
    __tablename__ = 'users'
    __table_args__ = {'schema': 'public'}

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id         = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=True)
    email             = Column(String(180), nullable=False, unique=True, index=True)
    full_name         = Column(String(180), nullable=False)
    password_hash     = Column(String(255), nullable=False)
    status            = Column(String(20),  nullable=False, default='active')
    is_platform_admin = Column(Boolean,     nullable=False, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())


class Role(Base):
    """Papel RBAC. Substitui AgentRole (V2 removido)."""
    __tablename__ = 'roles'
    __table_args__ = {'schema': 'public'}

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_code   = Column(String(60),  nullable=False, unique=True, index=True)
    role_name   = Column(String(120), nullable=False)
    scope_level = Column(String(30),  nullable=False)  # platform | tenant | company
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class Permission(Base):
    __tablename__ = 'permissions'
    __table_args__ = {'schema': 'public'}

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    permission_code = Column(String(100), nullable=False, unique=True, index=True)
    permission_name = Column(String(150), nullable=False)
    module_name     = Column(String(80),  nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────
# INFRA — Environments / Connectors  (MODELO ÚNICO)
# ─────────────────────────────────────────────────────────────

class Environment(Base):
    """Ambiente Protheus (prod, hml, dev). Substitui TenantConnector (V2 removido)."""
    __tablename__ = 'environments'
    __table_args__ = {'schema': 'public'}

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id          = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id         = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    env_code           = Column(String(60),  nullable=False)
    env_name           = Column(String(120), nullable=False)
    api_base_url       = Column(String(500), nullable=True)
    middleware_route   = Column(String(500), nullable=True)
    status             = Column(String(20),  nullable=False, default='active')
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())


class Connector(Base):
    """Conector REST/OAuth por ambiente. Substitui TenantConnector (V2 removido)."""
    __tablename__ = 'connectors'
    __table_args__ = {'schema': 'public'}

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id     = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    env_id         = Column(UUID(as_uuid=True), ForeignKey('public.environments.id', ondelete='CASCADE'), index=True, nullable=True)
    connector_type = Column(String(50),  nullable=False)           # rest | oauth | token
    connector_name = Column(String(150), nullable=False)
    base_url       = Column(String(500), nullable=True)
    auth_type      = Column(String(50),  nullable=True)
    secret_ref     = Column(String(200), nullable=True)            # referência ao vault/env
    status         = Column(String(20),  nullable=False, default='active')
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# GOVERNANÇA — Licença / Plano / Contrato  (MODELO ÚNICO V4)
# ─────────────────────────────────────────────────────────────

class LicensePlan(Base):
    """Plano de licença da plataforma. Substitui CompanyLicense (V2 removido)."""
    __tablename__ = 'license_plans'
    __table_args__ = {'schema': 'public'}

    id                       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code                = Column(String(60),  nullable=False, unique=True, index=True)
    plan_name                = Column(String(150), nullable=False)
    billing_cycle            = Column(String(20),  nullable=False, default='monthly')
    query_limit              = Column(Integer,     nullable=True)
    concurrent_sessions_limit= Column(Integer,     nullable=True)
    overage_mode             = Column(String(20),  nullable=False, default='block')
    active                   = Column(Boolean,     nullable=False, default=True)
    created_at               = Column(DateTime(timezone=True), server_default=func.now())
    updated_at               = Column(DateTime(timezone=True), onupdate=func.now())


class TenantContract(Base):
    __tablename__ = 'tenant_contracts'
    __table_args__ = {'schema': 'public'}

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id                   = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    plan_id                     = Column(UUID(as_uuid=True), ForeignKey('public.license_plans.id'), nullable=True)
    contract_code               = Column(String(80),  nullable=False, unique=True)
    contract_status             = Column(String(20),  nullable=False, default='active')
    starts_at                   = Column(Date,        nullable=False)
    ends_at                     = Column(Date,        nullable=True)
    query_limit_override        = Column(Integer,     nullable=True)
    concurrent_sessions_override= Column(Integer,     nullable=True)
    overage_mode_override       = Column(String(20),  nullable=True)
    notes                       = Column(Text,        nullable=True)
    created_at                  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at                  = Column(DateTime(timezone=True), onupdate=func.now())

class QueryUsageCounter(Base):
    __tablename__ = 'query_usage_counters'
    __table_args__ = {'schema': 'public'}

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    contract_id      = Column(UUID(as_uuid=True), ForeignKey('public.tenant_contracts.id', ondelete='CASCADE'), nullable=False)
    period_ref       = Column(String(20),  nullable=False)   # ex: '2026-07'
    total_queries    = Column(Integer,     nullable=False, default=0)
    blocked_queries  = Column(Integer,     nullable=False, default=0)
    overage_queries  = Column(Integer,     nullable=False, default=0)
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())


class ConcurrentSession(Base):
    __tablename__ = 'concurrent_sessions'
    __table_args__ = {'schema': 'public'}

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    user_id        = Column(UUID(as_uuid=True), ForeignKey('public.users.id', ondelete='CASCADE'), nullable=True)
    session_key    = Column(String(120), nullable=False, unique=True, index=True)
    started_at     = Column(DateTime(timezone=True), server_default=func.now())
    expires_at     = Column(DateTime(timezone=True), nullable=True)
    session_status = Column(String(20),  nullable=False, default='active')


# ─────────────────────────────────────────────────────────────
# MÓDULOS PROTHEUS  (MODELO ÚNICO V4)
# ─────────────────────────────────────────────────────────────

class ProtheusModuleMaster(Base):
    """Catálogo global de módulos. Substitui ProtheusModule (V2 removido)."""
    __tablename__ = 'protheus_modules_master'
    __table_args__ = {'schema': 'public'}

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_code = Column(String(30),  nullable=False, unique=True, index=True)
    module_name = Column(String(150), nullable=False)
    source_name = Column(String(60),  nullable=False, default='SYS_USR_MODULE')
    active      = Column(Boolean,     nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class TenantModuleContract(Base):
    __tablename__ = 'tenant_module_contracts'
    __table_args__ = {'schema': 'public'}

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey('public.tenant_contracts.id', ondelete='CASCADE'), nullable=False)
    module_id   = Column(UUID(as_uuid=True), ForeignKey('public.protheus_modules_master.id'), nullable=False)
    status      = Column(String(20),  nullable=False, default='allowed')
    created_at  = Column(DateTime(timezone=True), server_default=func.now())



# ─────────────────────────────────────────────────────────────
# DICIONÁRIO DE DADOS PROTHEUS
# ─────────────────────────────────────────────────────────────

class DictionarySnapshot(Base):
    __tablename__ = 'dictionary_snapshots'

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id     = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    env_id         = Column(UUID(as_uuid=True), ForeignKey('public.environments.id'), nullable=True)
    snapshot_code  = Column(String(80),  nullable=False)
    source_db_type = Column(String(30),  nullable=False, default='oracle')
    source_label   = Column(String(150), nullable=True)
    sync_mode      = Column(String(20),  nullable=False, default='full')
    sync_status    = Column(String(20),  nullable=False, default='completed')
    requested_by   = Column(UUID(as_uuid=True), nullable=True)
    started_at     = Column(DateTime(timezone=True), server_default=func.now())
    finished_at    = Column(DateTime(timezone=True), nullable=True)
    total_modules  = Column(Integer, default=0)
    total_tables   = Column(Integer, default=0)
    total_fields   = Column(Integer, default=0)
    total_indexes  = Column(Integer, default=0)
    notes          = Column(Text, nullable=True)


class TenantDictionaryTable(Base):
    __tablename__ = 'tenant_dictionary_tables'

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id      = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False, index=True)
    tenant_id        = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id       = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    env_id           = Column(UUID(as_uuid=True), ForeignKey('public.environments.id'), nullable=True)
    module_code      = Column(String(30),  nullable=True)
    table_key        = Column(String(20),  nullable=False)
    physical_name    = Column(String(30),  nullable=False)
    table_name       = Column(String(255), nullable=True)
    unique_index_expr= Column(Text,        nullable=True)
    x2_tamfil        = Column(Numeric(10,2), nullable=True)
    x2_modo          = Column(String(5),   nullable=True)
    x2_tamun         = Column(Numeric(10,2), nullable=True)
    x2_modoun        = Column(String(5),   nullable=True)
    x2_tamemp        = Column(Numeric(10,2), nullable=True)
    x2_modoemp       = Column(String(5),   nullable=True)
    usa_empresa      = Column(String(1),   nullable=False, default='N')
    usa_unidade      = Column(String(1),   nullable=False, default='N')
    usa_filial       = Column(String(1),   nullable=False, default='N')
    active           = Column(Boolean,     nullable=False, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class TenantDictionaryField(Base):
    __tablename__ = 'tenant_dictionary_fields'

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id       = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False)
    tenant_id         = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    table_id          = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_tables.id', ondelete='CASCADE'), nullable=False, index=True)
    field_name        = Column(String(40),  nullable=False)
    field_description = Column(String(255), nullable=True)
    field_type        = Column(String(5),   nullable=True)
    field_length      = Column(Numeric(10,2), nullable=True)
    field_order       = Column(Integer,     nullable=True)
    sxg_group         = Column(String(20),  nullable=True)
    sxg_size          = Column(Numeric(10,2), nullable=True)
    is_sensitive      = Column(Boolean,     nullable=False, default=False)
    mask_rule         = Column(String(50),  nullable=True)
    active            = Column(Boolean,     nullable=False, default=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())


class TenantDictionaryIndex(Base):
    __tablename__ = 'tenant_dictionary_indexes'

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id      = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False)
    tenant_id        = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    table_id         = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_tables.id', ondelete='CASCADE'), nullable=False, index=True)
    index_order      = Column(Integer,     nullable=True)
    index_nickname   = Column(String(80),  nullable=True)
    index_expression = Column(Text,        nullable=False)
    is_unique        = Column(Boolean,     nullable=False, default=False)
    is_primary_hint  = Column(Boolean,     nullable=False, default=False)
    active           = Column(Boolean,     nullable=False, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────
# CONTROLE DE ACESSO AO DICIONÁRIO  (MODELO ÚNICO V4)
# ─────────────────────────────────────────────────────────────

class TenantAllowedTable(Base):
    """Tabela Protheus permitida por contrato. Substitui AllowedTable (V2 removido)."""
    __tablename__ = 'tenant_allowed_tables'

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey('public.tenant_contracts.id', ondelete='CASCADE'), nullable=False)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False)
    table_id    = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_tables.id', ondelete='CASCADE'), nullable=False)
    access_level= Column(String(20),  nullable=False, default='query')  # query | write | admin
    allowed     = Column(Boolean,     nullable=False, default=True)
    rationale   = Column(String(255), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


# Alias para retrocompatibilidade
V4TenantAllowedTable = TenantAllowedTable


class TenantAllowedField(Base):
    __tablename__ = 'tenant_allowed_fields'

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    allowed_table_id = Column(UUID(as_uuid=True), ForeignKey('tenant_allowed_tables.id', ondelete='CASCADE'), nullable=False)
    field_id         = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_fields.id', ondelete='CASCADE'), nullable=False)
    allowed          = Column(Boolean, nullable=False, default=True)
    masking_required = Column(Boolean, nullable=False, default=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────
# KNOWLEDGE BASE / RAG
# ─────────────────────────────────────────────────────────────

class KnowledgeBase(Base):
    __tablename__ = 'knowledge_bases'

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id       = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    kb_code          = Column(String(60),  nullable=False)
    kb_name          = Column(String(200), nullable=False)
    storage_type     = Column(String(50),  nullable=False, default='r2')
    storage_prefix   = Column(String(500), nullable=False)
    vector_collection= Column(String(200), nullable=True)
    status           = Column(String(20),  nullable=False, default='active')
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())


class Document(Base):
    __tablename__ = 'documents'

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id   = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False, server_default='default')
    visibility  = Column(String(20),  nullable=False, server_default='tenant', index=True)
    title       = Column(String(255), nullable=False)
    source_path = Column(String(1024),nullable=False)
    source_type = Column(String(50),  nullable=True)
    module      = Column(String(100), nullable=True)
    category    = Column(String(100), nullable=True)
    version     = Column(String(50),  nullable=True)
    status      = Column(String(50),  nullable=True)
    checksum    = Column(String(64),  unique=True, index=True)
    language    = Column(String(10),  nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class DocumentChunk(Base):
    __tablename__ = 'document_chunks'

    id              = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id     = Column(Integer, ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    chunk_order     = Column(Integer, nullable=False)
    content         = Column(Text,    nullable=False)
    token_count     = Column(Integer, nullable=True)
    embedding_model = Column(String(100), nullable=True)
    vector          = Column(Vector(3072), nullable=True)   # text-embedding-3-large = 3072
    page_number     = Column(Integer, nullable=True)
    section         = Column(String(255), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────
# MEMÓRIA DO AGENTE
# ─────────────────────────────────────────────────────────────

class Memory(Base):
    __tablename__ = 'memories'

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id    = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False, server_default='default')
    company_id   = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    visibility   = Column(String(20),  nullable=False, server_default='tenant', index=True)
    memory_key   = Column(String(255), nullable=False, index=True)
    memory_value = Column(Text,        nullable=False)
    memory_type  = Column(String(50),  nullable=True)
    scope        = Column(String(100), nullable=True)
    tags         = Column(JSON,        nullable=True)
    confidence   = Column(Integer,     nullable=True)
    source       = Column(String(255), nullable=True)
    expires_at   = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# CATÁLOGO DE SCHEMAS (SX2/SX3 sincronizados)
# ─────────────────────────────────────────────────────────────

class TenantSchema(Base):
    __tablename__ = 'tenant_schemas'

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id   = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    modulo      = Column(String(50),  index=True, nullable=True)
    chave       = Column(String(10),  index=True, nullable=False)
    tabela      = Column(String(50),  nullable=True)
    nome        = Column(String(255), nullable=True)
    schema_json = Column(JSON,        nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


# ─────────────────────────────────────────────────────────────
# AUDITORIA
# ─────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    __table_args__ = {'schema': 'public'}

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(String(100), ForeignKey('public.tenants.id', ondelete='SET NULL'), index=True, nullable=True)
    company_id  = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    user_id     = Column(String(100), nullable=True)
    module_name = Column(String(80),  nullable=False)
    action_name = Column(String(120), nullable=False)
    target_type = Column(String(80),  nullable=True)
    target_id   = Column(String(120), nullable=True)
    request_id  = Column(String(120), nullable=True)
    details_json= Column(JSON,        nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class AgentQueryAudit(Base):
    """Log de cada consulta gerada pelo agente. Substitui ApiUsageLog (V2 removido)."""
    __tablename__ = 'agent_query_audit'

    id                     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id              = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id             = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    env_id                 = Column(UUID(as_uuid=True), ForeignKey('public.environments.id'), nullable=True)
    user_id                = Column(UUID(as_uuid=True), ForeignKey('public.users.id'), nullable=True)
    contract_id            = Column(UUID(as_uuid=True), ForeignKey('public.tenant_contracts.id'), nullable=True)
    snapshot_id            = Column(UUID(as_uuid=True), nullable=True)
    request_id             = Column(String(120), nullable=True)
    natural_language_prompt= Column(Text,        nullable=True)
    generated_sql          = Column(Text,        nullable=True)
    sql_hash               = Column(String(128), nullable=True, index=True)
    execution_status       = Column(String(20),  nullable=False, default='planned')
    rows_returned          = Column(Integer,     nullable=True)
    response_time_ms       = Column(Integer,     nullable=True)
    blocked_reason         = Column(String(255), nullable=True)
    tables_used            = Column(Text,        nullable=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────
# ONBOARDING
# ─────────────────────────────────────────────────────────────

class OnboardingProject(Base):
    __tablename__ = 'onboarding_projects'
    __table_args__ = {'schema': 'public'}

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id         = Column(String(100), ForeignKey('public.tenants.id', ondelete='CASCADE'), index=True, nullable=False)
    company_id        = Column(Integer,     ForeignKey('public.companies.id', ondelete='SET NULL'), index=True, nullable=True)
    project_code      = Column(String(60),  nullable=False)
    project_name      = Column(String(180), nullable=False)
    onboarding_status = Column(String(30),  nullable=False, default='planned')
    go_live_target_date= Column(Date,       nullable=True)
    owner_name        = Column(String(180), nullable=True)
    owner_email       = Column(String(180), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())


class OnboardingTask(Base):
    __tablename__ = 'onboarding_tasks'
    __table_args__ = {'schema': 'public'}

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    onboarding_project_id= Column(UUID(as_uuid=True), ForeignKey('public.onboarding_projects.id', ondelete='CASCADE'), nullable=False)
    task_code            = Column(String(80),  nullable=False)
    task_name            = Column(String(200), nullable=False)
    task_type            = Column(String(50),  nullable=False)
    mandatory            = Column(Boolean,     nullable=False, default=True)
    task_status          = Column(String(30),  nullable=False, default='pending')
    assigned_to          = Column(String(180), nullable=True)
    due_date             = Column(Date,        nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())
