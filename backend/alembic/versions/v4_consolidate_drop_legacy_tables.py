"""v4_consolidate: drop tabelas legadas V2 e corrigir schema

Revision ID: v4_consolidate_001
Revises: (coloque aqui o ID da sua última migration)
Create Date: 2026-07-26

O QUE ESTA MIGRATION FAZ:
  DROP: agent_users, agent_roles, tenant_connectors,
        allowed_tables, protheus_modules,
        company_licenses, api_usage_logs
  ALTER: companies — renomeia protheus_password → encrypted_protheus_password
  ALTER: agent_query_audit — adiciona index em sql_hash
  ALTER: memories — adiciona company_id (FK opcional)
  ALTER: document_chunks — ajusta vector(4096) → vector(3072)

PRÉ-REQUISITO: pgvector instalado.
ATENÇÃO: Execute em staging ANTES de produção. Backup obrigatório.
"""
from alembic import op
import sqlalchemy as sa

revision = 'v4_consolidate_001'
down_revision = None   # ajuste para o ID da última migration existente
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Remover tabelas V2 legadas ────────────────────────
    # Ordem importa: dependentes antes das referenciadas
    op.execute("DROP TABLE IF EXISTS api_usage_logs       CASCADE")
    op.execute("DROP TABLE IF EXISTS company_licenses     CASCADE")
    op.execute("DROP TABLE IF EXISTS allowed_tables       CASCADE")
    op.execute("DROP TABLE IF EXISTS protheus_modules     CASCADE")
    op.execute("DROP TABLE IF EXISTS tenant_connectors    CASCADE")
    op.execute("DROP TABLE IF EXISTS agent_roles          CASCADE")
    op.execute("DROP TABLE IF EXISTS agent_users          CASCADE")

    # ── 2. companies: renomear coluna senha ──────────────────
    op.execute("""
        ALTER TABLE companies
        RENAME COLUMN protheus_password TO encrypted_protheus_password
    """)

    # ── 3. agent_query_audit: index em sql_hash ──────────────
    op.create_index(
        'ix_agent_query_audit_sql_hash',
        'agent_query_audit',
        ['sql_hash'],
        unique=False
    )

    # ── 4. memories: adicionar company_id ────────────────────
    op.add_column(
        'memories',
        sa.Column('company_id', sa.Integer(),
                  sa.ForeignKey('companies.id', ondelete='SET NULL'),
                  nullable=True)
    )
    op.create_index('ix_memories_company_id', 'memories', ['company_id'])

    # ── 5. document_chunks: corrigir dimensão do vector ──────
    # ATENÇÃO: apenas se você ainda NÃO tem dados em produção com vector(4096).
    # Se tiver, re-embedde os chunks antes de rodar este ALTER.
    op.execute("""
        ALTER TABLE document_chunks
        ALTER COLUMN vector TYPE vector(3072)
        USING vector::text::vector(3072)
    """)

    # ── 6. companies: garantir FK para tenants ───────────────
    # Adiciona a FK somente se não existir (idempotente)
    op.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_companies_tenant_id'
          ) THEN
            ALTER TABLE companies
            ADD CONSTRAINT fk_companies_tenant_id
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
          END IF;
        END $$;
    """)


def downgrade() -> None:
    # Recriar tabelas V2 removidas caso precise reverter
    # (estrutura mínima para não quebrar o rollback)

    op.execute("DROP INDEX IF EXISTS ix_agent_query_audit_sql_hash")
    op.execute("DROP INDEX IF EXISTS ix_memories_company_id")

    op.execute("""
        ALTER TABLE companies
        RENAME COLUMN encrypted_protheus_password TO protheus_password
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_users (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
            username VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_roles (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
            name VARCHAR(50) NOT NULL,
            permissions JSONB,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS api_usage_logs (
            id SERIAL PRIMARY KEY,
            company_id INTEGER,
            session_id VARCHAR(100),
            request_type VARCHAR(50) NOT NULL,
            prompt_tokens INTEGER NOT NULL DEFAULT 0,
            completion_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0,
            model_name VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)
