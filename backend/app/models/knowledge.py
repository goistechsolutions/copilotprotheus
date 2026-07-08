from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.db.database import Base

class Document(Base):
    __tablename__ = 'documents'
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
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
    # We use vector(4096) because Llama 3 has 4096 dimensions
    vector = Column(Vector(4096))
    page_number = Column(Integer)
    section = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Memory(Base):
    __tablename__ = 'memories'
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
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

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), index=True, nullable=False, server_default='default')
    user_name = Column(String(100))
    session_id = Column(String(100), index=True)
    question = Column(Text)
    answer = Column(Text)
    module = Column(String(100))
    document_ids = Column(JSON)
    memory_ids = Column(JSON)
    sql_used = Column(Text)
    rag_used = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Tenant(Base):
    __tablename__ = 'tenants'
    __table_args__ = {"schema": "public"}
    id = Column(String(100), primary_key=True, index=True) # tenant_id
    name = Column(String(255), nullable=False)
    protheus_rest_url = Column(String(1024), nullable=False)
    protheus_user = Column(String(255), nullable=False)
    encrypted_protheus_password = Column(Text, nullable=False)
    auth_mode = Column(String(50), server_default='basic')
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, server_default='0.7')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Company(Base):
    __tablename__ = 'companies'
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True) # Código sequencial automático
    cnpj = Column(String(20), unique=True, index=True, nullable=False)
    ie = Column(String(50), nullable=True)
    razao_social = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    telefone = Column(String(50), nullable=True)
    endereco = Column(Text, nullable=True)
    
    # Protheus integration fields
    protheus_grupo = Column(String(50), nullable=False) # Grupo de empresas
    protheus_empresa = Column(String(50), nullable=True)  # Código de empresa
    protheus_unidade = Column(String(50), nullable=True)  # Unidade de negócio
    protheus_filial = Column(String(50), nullable=False)   # Código de filial
    protheus_ambientes = Column(String(255), nullable=False) # Ambientes (ex: "producao,validacao")
    protheus_usuario = Column(String(100), nullable=True) # Código de usuário
    protheus_rest_url = Column(String(1024), nullable=True) # URL do portal REST do Protheus
    protheus_webapp_url = Column(String(1024), nullable=True) # URL do WebClient/WebApp do Protheus
    licenca_uso = Column(Text, nullable=True) # Usage license token
    status = Column(String(50), server_default='ativa') # ativa/inativa
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
