-- Copilot Protheus - Schema Completo do Banco de Conhecimento
-- Banco sugerido: PostgreSQL

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    source_path TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'file',
    module VARCHAR(50),
    category VARCHAR(100),
    version VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    checksum VARCHAR(128),
    language VARCHAR(10) DEFAULT 'pt-BR',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_module ON documents(module);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_checksum ON documents(checksum);

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk क्रम INTEGER NOT NULL,
    content ტექסט NOT NULL,
    token_count INTEGER,
    embedding_model VARCHAR(120),
    vector_id VARCHAR(128),
    page_number INTEGER,
    section VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_page_number ON document_chunks(page_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_chunks_doc_chunk ON document_chunks(document_id, chunk क्रम);

CREATE TABLE IF NOT EXISTS memories (
    id BIGSERIAL PRIMARY KEY,
    memory_key VARCHAR(150) NOT NULL,
    memory_value TEXT NOT NULL,
    memory_type VARCHAR(50) DEFAULT 'fact',
    scope VARCHAR(50) DEFAULT 'project',
    tags TEXT,
    confidence NUMERIC(5,2) DEFAULT 1.00,
    source VARCHAR(150),
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(memory_key);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_expires_at ON memories(expires_at);

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    source_kind VARCHAR(50) NOT NULL,
    base_path TEXT,
    url TEXT,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_kind ON knowledge_sources(source_kind);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_active ON knowledge_sources(active);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(150),
    session_id VARCHAR(150),
    question TEXT NOT NULL,
    answer TEXT,
    module VARCHAR(50),
    document_ids TEXT,
    memory_ids TEXT,
    sql_used BOOLEAN DEFAULT FALSE,
    rag_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_name ON audit_logs(user_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS document_tags (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);

CREATE TABLE IF NOT EXISTS document_permissions (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    profile_name VARCHAR(150) NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_index BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, profile_name)
);

CREATE INDEX IF NOT EXISTS idx_document_permissions_profile ON document_permissions(profile_name);

CREATE TABLE IF NOT EXISTS processing_jobs (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    message TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_type ON processing_jobs(job_type);

-- Se usar PostgreSQL com pgvector, habilitar a extensão e incluir a coluna abaixo
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE document_chunks ADD COLUMN embedding vector(1536);
