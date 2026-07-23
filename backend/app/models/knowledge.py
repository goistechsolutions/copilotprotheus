from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean, Date, Table
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
    Column('tenant_id', UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), primary_key=True),
    Column('company_id', UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True),
    Column('env_id', UUID(as_uuid=True), ForeignKey('environments.id', ondelete='CASCADE'))
)

user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('tenant_id', UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), primary_key=True),
    Column('company_id', UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), primary_key=True)
)

# ======== NOVOS MODELOS V3/V4 ========

class Tenant(Base):
    __tablename__ = 'tenants'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_code = Column(String(60), nullable=False, unique=True)
    tenant_name = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False, default='active')
    plan_code = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Company(Base):
    __tablename__ = 'companies'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    company_code = Column(String(60), nullable=False)
    company_name = Column(String(200), nullable=False)
    protheus_env = Column(String(100))
    protheus_branch = Column(String(100))
    status = Column(String(20), nullable=False, default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Environment(Base):
    __tablename__ = 'environments'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'), nullable=False, index=True)
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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'), index=True)
    env_id = Column(UUID(as_uuid=True), ForeignKey('environments.id'), index=True)
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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'))
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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'))
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
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'))
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
    tenant_id = Column(UUID(as_uuid=True))
    company_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True))
    module_name = Column(String(80), nullable=False)
    action_name = Column(String(120), nullable=False)
    target_type = Column(String(80))
    target_id = Column(String(120))
    request_id = Column(String(120))
    details_json = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ======== MODELOS EXISTENTES MANTIDOS ========

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
    company_id = Column(UUID(as_uuid=True), index=True, nullable=False, unique=True)
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
    company_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    session_id = Column(String(100), index=True, nullable=True)
    request_type = Column(String(50), nullable=False) 
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    model_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
