from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean, Date, Table, Numeric
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.db.database import Base
import uuid

# Tabelas de Associação (Many-to-Many)
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', UUID(as_uuid=True), ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True)
)

user_company_access = Table(
    'user_company_access',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('tenant_id', String(100), ForeignKey('tenants.id', ondelete='CASCADE'), primary_key=True),
    Column('company_id', Integer, ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True),
    Column('env_id', UUID(as_uuid=True), ForeignKey('environments.id', ondelete='CASCADE'))
)

user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('tenant_id', String(100), ForeignKey('tenants.id', ondelete='CASCADE'), primary_key=True),
    Column('company_id', Integer, ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True)
)

# ======== MODELOS PRINCIPAIS TENANT & COMPANY (V2/V3/V4 UNIFICADOS) ========

class Tenant(Base):
    __tablename__ = 'tenants'
    __table_args__ = {"schema": "public"}
    id = Column(String(100), primary_key=True, index=True) # ex: 'default' ou 'cliente_alpha'
    name = Column(String(255), nullable=True)
    tenant_code = Column(String(100), nullable=True, index=True)
    tenant_name = Column(String(255), nullable=True)
    protheus_rest_url = Column(String(1024), nullable=True)
    protheus_user = Column(String(255), nullable=True)
    encrypted_protheus_password = Column(Text, nullable=True)
    auth_mode = Column(String(50), server_default='basic')
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, server_default='0.7')
    status = Column(String(50), server_default='active')
    plan_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Company(Base):
    __tablename__ = 'companies'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=True)
    cnpj = Column(String(30), index=True, nullable=True)
    ie = Column(String(30), nullable=True)
    razao_social = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    telefone = Column(String(50), nullable=True)
    endereco = Column(String(500), nullable=True)
    protheus_grupo = Column(String(20), nullable=True)
    protheus_empresa = Column(String(20), nullable=True)
    protheus_unidade = Column(String(20), nullable=True)
    protheus_filial = Column(String(30), nullable=True)
    protheus_ambientes = Column(String(100), server_default='producao')
    protheus_usuario = Column(String(100), nullable=True)
    protheus_password = Column(String(255), nullable=True)
    protheus_rest_url = Column(String(1024), nullable=True)
    protheus_webapp_url = Column(String(1024), nullable=True)
    licenca_uso = Column(Text, nullable=True)
    status = Column(String(50), server_default='ativa')
    company_code = Column(String(60), nullable=True)
    company_name = Column(String(200), nullable=True)
    protheus_env = Column(String(100), nullable=True)
    protheus_branch = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AgentUser(Base):
    __tablename__ = 'agent_users'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
    username = Column(String(100), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), server_default='user')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AgentRole(Base):
    __tablename__ = 'agent_roles'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
    name = Column(String(50), nullable=False)
    permissions = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TenantConnector(Base):
    __tablename__ = 'tenant_connectors'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False)
    environment = Column(String(100), nullable=False, server_default='producao')
    rest_url = Column(String(1024), nullable=False)
    auth_mode = Column(String(50), server_default='basic')
    username = Column(String(255), nullable=True)
    password_hash = Column(Text, nullable=True)
    token = Column(Text, nullable=True)
    is_active = Column(Boolean, server_default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Environment(Base):
    __tablename__ = 'environments'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    env_code = Column(String(60), nullable=False)
    env_name = Column(String(120), nullable=False)
    api_base_url = Column(String(500))
    middleware_route = Column(String(500))
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Connector(Base):
    __tablename__ = 'connectors'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    env_id = Column(UUID(as_uuid=True), ForeignKey('environments.id'), index=True, nullable=True)
    connector_type = Column(String(50), nullable=False)
    connector_name = Column(String(150), nullable=False)
    base_url = Column(String(500))
    auth_type = Column(String(50))
    secret_ref = Column(String(200))
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class KnowledgeBase(Base):
    __tablename__ = 'knowledge_bases'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    kb_code = Column(String(60), nullable=False)
    kb_name = Column(String(200), nullable=False)
    storage_type = Column(String(50), nullable=False, default='r2')
    storage_prefix = Column(String(500), nullable=False)
    vector_collection = Column(String(200))
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Role(Base):
    __tablename__ = 'roles'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_code = Column(String(60), nullable=False, unique=True)
    role_name = Column(String(120), nullable=False)
    scope_level = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Permission(Base):
    __tablename__ = 'permissions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    permission_code = Column(String(100), nullable=False, unique=True)
    permission_name = Column(String(150), nullable=False)
    module_name = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=True)
    email = Column(String(180), nullable=False, unique=True)
    full_name = Column(String(180), nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default='active')
    is_platform_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class OnboardingProject(Base):
    __tablename__ = 'onboarding_projects'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    project_code = Column(String(60), nullable=False)
    project_name = Column(String(180), nullable=False)
    onboarding_status = Column(String(30), nullable=False, default='planned')
    go_live_target_date = Column(Date)
    owner_name = Column(String(180))
    owner_email = Column(String(180))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class OnboardingTask(Base):
    __tablename__ = 'onboarding_tasks'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    onboarding_project_id = Column(UUID(as_uuid=True), ForeignKey('onboarding_projects.id', ondelete='CASCADE'), nullable=False)
    task_code = Column(String(80), nullable=False)
    task_name = Column(String(200), nullable=False)
    task_type = Column(String(50), nullable=False)
    mandatory = Column(Boolean, nullable=False, default=True)
    task_status = Column(String(30), nullable=False, default='pending')
    assigned_to = Column(String(180))
    due_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=True)
    company_id = Column(Integer, index=True, nullable=True)
    user_id = Column(String(100), nullable=True)
    module_name = Column(String(80), nullable=False)
    action_name = Column(String(120), nullable=False)
    target_type = Column(String(80))
    target_id = Column(String(120))
    request_id = Column(String(120))
    details_json = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Document(Base):
    __tablename__ = 'documents'
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
    visibility = Column(String(20), nullable=False, server_default='tenant', index=True)
    title = Column(String(255), nullable=False)
    source_path = Column(String(1024), nullable=False)
    source_type = Column(String(50))
    module = Column(String(100))
    category = Column(String(100))
    version = Column(String(50))
    status = Column(String(50))
    checksum = Column(String(64), unique=True, index=True)
    language = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey('documents.id', ondelete='CASCADE'), nullable=False)
    chunk_order = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer)
    embedding_model = Column(String(100))
    vector = Column(Vector(4096))
    page_number = Column(Integer)
    section = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Memory(Base):
    __tablename__ = 'memories'
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
    visibility = Column(String(20), nullable=False, server_default='tenant', index=True)
    memory_key = Column(String(255), nullable=False, index=True)
    memory_value = Column(Text, nullable=False)
    memory_type = Column(String(50))
    scope = Column(String(100))
    tags = Column(JSON)
    confidence = Column(Integer)
    source = Column(String(255))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AllowedTable(Base):
    __tablename__ = 'allowed_tables'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
    alias = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    tipo = Column(String(100), nullable=True)
    fields = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TenantSchema(Base):
    __tablename__ = 'tenant_schemas'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False)
    modulo = Column(String(50), index=True, nullable=True)
    chave = Column(String(10), index=True, nullable=False)
    tabela = Column(String(50), nullable=True)
    nome = Column(String(255), nullable=True)
    schema_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ProtheusModule(Base):
    __tablename__ = 'protheus_modules'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False)
    usr_modulo = Column(String(50), index=True, nullable=False)
    usr_codmod = Column(String(50), index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CompanyLicense(Base):
    __tablename__ = 'company_licenses'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id = Column(Integer, index=True, nullable=False, unique=True)
    max_tokens_monthly = Column(Integer, server_default='1000000')
    max_concurrent_users = Column(Integer, server_default='1')
    allow_overage = Column(Boolean, server_default='false', nullable=False)
    allowed_modules = Column(JSON, nullable=True)
    access_groups = Column(JSON, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ApiUsageLog(Base):
    __tablename__ = 'api_usage_logs'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id = Column(Integer, index=True, nullable=True)
    session_id = Column(String(100), index=True, nullable=True)
    request_type = Column(String(50), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    model_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ======== NOVOS MODELOS V4 (GOVERNANÇA) ========

class LicensePlan(Base):
    __tablename__ = 'license_plans'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(60), nullable=False, unique=True)
    plan_name = Column(String(150), nullable=False)
    billing_cycle = Column(String(20), nullable=False, default='monthly')
    query_limit = Column(Integer)
    concurrent_sessions_limit = Column(Integer)
    overage_mode = Column(String(20), nullable=False, default='block')
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TenantContract(Base):
    __tablename__ = 'tenant_contracts'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey('license_plans.id'), nullable=True)
    contract_code = Column(String(80), nullable=False, unique=True)
    contract_status = Column(String(20), nullable=False, default='active')
    starts_at = Column(Date, nullable=False)
    ends_at = Column(Date)
    query_limit_override = Column(Integer)
    concurrent_sessions_override = Column(Integer)
    overage_mode_override = Column(String(20))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ProtheusModuleMaster(Base):
    __tablename__ = 'protheus_modules_master'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_code = Column(String(30), nullable=False, unique=True)
    module_name = Column(String(150), nullable=False)
    source_name = Column(String(60), nullable=False, default='SYS_USR_MODULE')
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TenantModuleContract(Base):
    __tablename__ = 'tenant_module_contracts'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey('tenant_contracts.id', ondelete='CASCADE'), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey('protheus_modules_master.id'), nullable=False)
    status = Column(String(20), nullable=False, default='allowed')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DictionarySnapshot(Base):
    __tablename__ = 'dictionary_snapshots'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    env_id = Column(UUID(as_uuid=True), ForeignKey('environments.id'), nullable=True)
    snapshot_code = Column(String(80), nullable=False)
    source_db_type = Column(String(30), nullable=False, default='oracle')
    source_label = Column(String(150))
    sync_mode = Column(String(20), nullable=False, default='full')
    sync_status = Column(String(20), nullable=False, default='completed')
    requested_by = Column(UUID(as_uuid=True), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    total_modules = Column(Integer, default=0)
    total_tables = Column(Integer, default=0)
    total_fields = Column(Integer, default=0)
    total_indexes = Column(Integer, default=0)
    notes = Column(Text)

class TenantDictionaryTable(Base):
    __tablename__ = 'tenant_dictionary_tables'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False, index=True)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    env_id = Column(UUID(as_uuid=True), ForeignKey('environments.id'), nullable=True)
    module_code = Column(String(30))
    table_key = Column(String(20), nullable=False)
    physical_name = Column(String(30), nullable=False)
    table_name = Column(String(255))
    unique_index_expr = Column(Text)
    x2_tamfil = Column(Numeric(10,2))
    x2_modo = Column(String(5))
    x2_tamun = Column(Numeric(10,2))
    x2_modoun = Column(String(5))
    x2_tamemp = Column(Numeric(10,2))
    x2_modoemp = Column(String(5))
    usa_empresa = Column(String(1), nullable=False, default='N')
    usa_unidade = Column(String(1), nullable=False, default='N')
    usa_filial = Column(String(1), nullable=False, default='N')
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TenantDictionaryField(Base):
    __tablename__ = 'tenant_dictionary_fields'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False)
    tenant_id = Column(String(100), index=True, nullable=False)
    table_id = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_tables.id', ondelete='CASCADE'), nullable=False, index=True)
    field_name = Column(String(40), nullable=False)
    field_description = Column(String(255))
    field_type = Column(String(5))
    field_length = Column(Numeric(10,2))
    field_order = Column(Integer)
    sxg_group = Column(String(20))
    sxg_size = Column(Numeric(10,2))
    is_sensitive = Column(Boolean, nullable=False, default=False)
    mask_rule = Column(String(50))
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TenantDictionaryIndex(Base):
    __tablename__ = 'tenant_dictionary_indexes'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False)
    tenant_id = Column(String(100), index=True, nullable=False)
    table_id = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_tables.id', ondelete='CASCADE'), nullable=False, index=True)
    index_order = Column(Integer)
    index_nickname = Column(String(80))
    index_expression = Column(Text, nullable=False)
    is_unique = Column(Boolean, nullable=False, default=False)
    is_primary_hint = Column(Boolean, nullable=False, default=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class V4TenantAllowedTable(Base):
    __tablename__ = 'tenant_allowed_tables'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey('tenant_contracts.id', ondelete='CASCADE'), nullable=False)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id', ondelete='CASCADE'), nullable=False)
    table_id = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_tables.id', ondelete='CASCADE'), nullable=False)
    access_level = Column(String(20), nullable=False, default='query')
    allowed = Column(Boolean, nullable=False, default=True)
    rationale = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class V4TenantAllowedField(Base):
    __tablename__ = 'tenant_allowed_fields'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    allowed_table_id = Column(UUID(as_uuid=True), ForeignKey('tenant_allowed_tables.id', ondelete='CASCADE'), nullable=False)
    field_id = Column(UUID(as_uuid=True), ForeignKey('tenant_dictionary_fields.id', ondelete='CASCADE'), nullable=False)
    allowed = Column(Boolean, nullable=False, default=True)
    masking_required = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QueryUsageCounter(Base):
    __tablename__ = 'query_usage_counters'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey('tenant_contracts.id', ondelete='CASCADE'), nullable=False)
    period_ref = Column(String(20), nullable=False)
    total_queries = Column(Integer, nullable=False, default=0)
    blocked_queries = Column(Integer, nullable=False, default=0)
    overage_queries = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ConcurrentSession(Base):
    __tablename__ = 'concurrent_sessions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    session_key = Column(String(120), nullable=False, unique=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    session_status = Column(String(20), nullable=False, default='active')

class AgentQueryAudit(Base):
    __tablename__ = 'agent_query_audit'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(100), index=True, nullable=False)
    company_id = Column(Integer, index=True, nullable=True)
    env_id = Column(UUID(as_uuid=True), ForeignKey('environments.id'), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey('tenant_contracts.id'), nullable=True)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey('dictionary_snapshots.id'), nullable=True)
    request_id = Column(String(120))
    natural_language_prompt = Column(Text)
    generated_sql = Column(Text)
    sql_hash = Column(String(128))
    execution_status = Column(String(20), nullable=False, default='planned')
    rows_returned = Column(Integer)
    response_time_ms = Column(Integer)
    blocked_reason = Column(String(255))
    tables_used = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
