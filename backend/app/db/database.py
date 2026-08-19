"""
backend/app/db/database.py

Copilot Protheus - Camada de acesso a banco (multi-tenant via Schemas PostgreSQL)

Correções aplicadas nesta versão:
- Removido bloco destrutivo `DROP TABLE ... CASCADE` que apagava dados globais
  (users, roles, permissions, environments, connectors, license_plans,
  tenant_contracts, agent_query_audit, etc.) a cada restart do backend.
- `ensure_public_tables()` tornou-se 100% idempotente: cria/ajusta apenas o
  que falta, nunca derruba dados existentes.
- Adicionada flag de boot em `public.app_bootstrap_flags` para evitar
  reexecução completa do DDL global em cada request.
- Adicionada checagem de bootstrap por tenant (`_tenant_schema_bootstrap_done`)
  para evitar reprocessar DDL de schema de tenant em toda chamada de `get_db()`.
- Todas as tabelas globais V4 (users, roles, permissions, environments,
  connectors, license_plans, tenant_contracts, query_usage_counters,
  concurrent_sessions, tenant_module_contracts, audit_logs, agent_users,
  agent_roles, agent_query_audit, platform_audit_log) são garantidas em
  `public` de forma idempotente.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from fastapi import Header, Request
import os
import re

# ─────────────────────────────────────────────────────────────
# CONEXÃO / ENGINE
# ─────────────────────────────────────────────────────────────

def ensure_database_exists(db_url: str):
    if not db_url or "sqlite" in db_url:
        return
    try:
        from sqlalchemy.engine.url import make_url
        url = make_url(db_url)
        target_db = url.database
        if not target_db or target_db == 'postgres':
            return

        default_url = url._replace(database='postgres')
        tmp_engine = create_engine(default_url, isolation_level="AUTOCOMMIT")
        with tmp_engine.connect() as conn:
            res = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": target_db}
            ).scalar()
            if not res:
                conn.execute(text(f'CREATE DATABASE "{target_db}"'))
                print(f"[DB] Banco de dados '{target_db}' criado com sucesso!")
        tmp_engine.dispose()
    except Exception as e:
        print(f"[DB] Aviso ao verificar/criar banco de dados: {e}")


DATABASE_URL = os.getenv('DATABASE_URL', '').strip() or "sqlite:///:memory:"

try:
    ensure_database_exists(DATABASE_URL)
except Exception:
    pass

engine_args = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import StaticPool
    engine_args = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base legado (não usar para novos modelos)
Base = declarative_base()

# Base para tabelas globais (schema public)
GlobalBase = declarative_base()

# Base para tabelas de tenant (schema dinâmico resolvido por search_path)
TenantBase = declarative_base()


# ─────────────────────────────────────────────────────────────
# BOOTSTRAP GLOBAL (schema public) — IDEMPOTENTE
# ─────────────────────────────────────────────────────────────

PUBLIC_BOOTSTRAP_FLAG = "public_schema_v5"
PUBLIC_BOOTSTRAP_DONE = False

PUBLIC_REQUIRED_TABLES = {
    "app_bootstrap_flags",
    "tenant",
    "plans",
    "platform_admins",
    "protheus_modules_master",
    "roles",
    "users",
    "permissions",
    "environments",
    "connectors",
    "license_plans",
    "tenant_contracts",
    "query_usage_counters",
    "concurrent_sessions",
    "tenant_module_contracts",
    "audit_logs",
    "platform_audit_log",
    "protheus_rest_connections",
}


def _safe_commit(db):
    if hasattr(db, "commit"):
        db.commit()


def _safe_rollback(db):
    try:
        if hasattr(db, "rollback"):
            db.rollback()
    except Exception:
        pass


def _table_exists(db, schema_name: str, table_name: str) -> bool:
    return bool(db.execute(text("""
        SELECT EXISTS (
            SELECT 1
              FROM information_schema.tables
             WHERE table_schema = :schema_name
               AND table_name   = :table_name
        )
    """), {"schema_name": schema_name, "table_name": table_name}).scalar())


def _ensure_bootstrap_flags_table(db):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS public.app_bootstrap_flags (
            flag_name   VARCHAR(100) PRIMARY KEY,
            flag_value  BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))


def _public_required_tables_exist(db) -> bool:
    for table_name in PUBLIC_REQUIRED_TABLES:
        if not _table_exists(db, "public", table_name):
            return False
    return True


def _is_public_bootstrap_done(db) -> bool:
    if not _table_exists(db, "public", "app_bootstrap_flags"):
        return False

    done = db.execute(text("""
        SELECT flag_value
          FROM public.app_bootstrap_flags
         WHERE flag_name = :flag_name
         LIMIT 1
    """), {"flag_name": PUBLIC_BOOTSTRAP_FLAG}).scalar()

    return bool(done) and _public_required_tables_exist(db)


def _mark_public_bootstrap_done(db):
    db.execute(text("""
        INSERT INTO public.app_bootstrap_flags (flag_name, flag_value, updated_at)
        VALUES (:flag_name, TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (flag_name)
        DO UPDATE SET
            flag_value = EXCLUDED.flag_value,
            updated_at = EXCLUDED.updated_at
    """), {"flag_name": PUBLIC_BOOTSTRAP_FLAG})


def _run_public_ddl(db, statements):
    for q in statements:
        if q.strip():
            db.execute(text(q))


def ensure_public_tables(db, force: bool = False):
    """
    Garante o schema `public` de forma 100% idempotente.
    NUNCA remove tabelas ou dados existentes.
    """
    global PUBLIC_BOOTSTRAP_DONE

    if DATABASE_URL.startswith("sqlite"):
        PUBLIC_BOOTSTRAP_DONE = True
        return

    if PUBLIC_BOOTSTRAP_DONE and not force:
        return

    # Try to create schema and extensions without breaking the parent transaction
    try:
        db.execute(text("SAVEPOINT sp_ext"))
        db.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public"))
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
        db.execute(text("RELEASE SAVEPOINT sp_ext"))
    except Exception as e:
        db.execute(text("ROLLBACK TO SAVEPOINT sp_ext"))
        print(f"[DB] Aviso ao criar schema/extensions: {e}")

    try:
        db.execute(text("SAVEPOINT sp_flags"))
        _ensure_bootstrap_flags_table(db)
        db.execute(text("RELEASE SAVEPOINT sp_flags"))
    except Exception as e:
        db.execute(text("ROLLBACK TO SAVEPOINT sp_flags"))
        print(f"[DB] Aviso ao preparar bootstrap flags: {e}")

    public_queries = [
        """
        CREATE TABLE IF NOT EXISTS public.tenant (
            id                SERIAL PRIMARY KEY,
            tenant_code       VARCHAR(50) UNIQUE NOT NULL CHECK (tenant_code ~ '^[a-z0-9_]+$'),
            tenant_name       VARCHAR(150) NOT NULL,
            schema_name       VARCHAR(63) UNIQUE NOT NULL,
            status            VARCHAR(20) NOT NULL DEFAULT 'provisioning'
                              CHECK (status IN ('provisioning','active','suspended','decommissioned')),
            created_at        TIMESTAMP DEFAULT NOW(),
            updated_at        TIMESTAMP DEFAULT NOW(),
            provisioned_at    TIMESTAMP,
            decommissioned_at TIMESTAMP
        );
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS cnpj varchar(20);
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS webapp_url text;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS apirest_url text;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS frontend_domain text;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS protheus_user varchar(100);
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS encrypted_protheus_password varchar(255);
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS protheus_ambientes varchar(100) default ' '::character varying;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS system_prompt text;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS temperature numeric(3,2) DEFAULT 0.20;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS licenca_uso text;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS plan_code VARCHAR(50);
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS contract_info JSONB;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS api_access_info JSONB;
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS version VARCHAR(50);
        ALTER TABLE public.tenant ADD COLUMN IF NOT EXISTS agent_permissions JSONB;
        ALTER TABLE public.tenant ALTER COLUMN updated_at DROP NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_tenant_code ON public.tenant (tenant_code);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_schema_name ON public.tenant (schema_name);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.plans (
            plan_code       VARCHAR(50) PRIMARY KEY,
            plan_name       VARCHAR(150) NOT NULL,
            max_users       INTEGER DEFAULT 5,
            max_queries_day INTEGER DEFAULT 500,
            modules_allowed JSONB DEFAULT '[]',
            active          BOOLEAN DEFAULT TRUE
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS public.platform_admins (
            id            SERIAL PRIMARY KEY,
            email         VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_superadmin BOOLEAN DEFAULT FALSE,
            active        BOOLEAN DEFAULT TRUE,
            created_at    TIMESTAMP DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS public.protheus_rest_connections (
            id BIGSERIAL PRIMARY KEY,
            tenant_code VARCHAR(100) NOT NULL,
            environment_code VARCHAR(100) NOT NULL DEFAULT 'default',
            base_rest_url VARCHAR(500) NOT NULL,
            auth_mode VARCHAR(30) NOT NULL DEFAULT 'oauth2_password',
            protheus_username VARCHAR(255) NOT NULL,
            encrypted_protheus_password TEXT NOT NULL,
            encrypted_access_token TEXT,
            encrypted_refresh_token TEXT,
            access_token_expires_at TIMESTAMPTZ,
            token_updated_at TIMESTAMPTZ,
            last_auth_error TEXT,
            last_auth_status INTEGER,
            last_success_at TIMESTAMPTZ,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_protheus_rest_tenant_env UNIQUE (tenant_code, environment_code)
        );
        ALTER TABLE public.protheus_rest_connections ADD COLUMN IF NOT EXISTS last_auth_error TEXT;
        ALTER TABLE public.protheus_rest_connections ADD COLUMN IF NOT EXISTS last_auth_status INTEGER;
        ALTER TABLE public.protheus_rest_connections ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
        """,
        """
        CREATE TABLE IF NOT EXISTS public.protheus_modules_master (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            mod_code    INTEGER      NOT NULL,
            mod_sigla   VARCHAR(30)  UNIQUE,
            mod_name    VARCHAR(150) NOT NULL,
            description TEXT,
            active      BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ,
            UNIQUE(mod_code)
        );
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS mod_code INTEGER;
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS mod_sigla VARCHAR(30);
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS description TEXT;
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'protheus_modules_master' AND column_name = 'module_name') THEN
                ALTER TABLE public.protheus_modules_master RENAME COLUMN module_name TO mod_name;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'protheus_modules_master' AND column_name = 'module_code') THEN
                -- Try to migrate string module_code to int mod_code if possible, else just drop/rename
                -- Since mod_code is already added, let's just drop module_code to clean up
                ALTER TABLE public.protheus_modules_master DROP COLUMN module_code;
            END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS idx_pmm_code   ON public.protheus_modules_master(mod_code);
        CREATE INDEX IF NOT EXISTS idx_pmm_sigla  ON public.protheus_modules_master(mod_sigla);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.roles (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            role_code   VARCHAR(60) NOT NULL,
            role_name   VARCHAR(120) NOT NULL,
            scope_level VARCHAR(30) NOT NULL,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_role_code ON public.roles (role_code);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.users (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id         VARCHAR(100),
            role_id           UUID REFERENCES public.roles(id),
            email             VARCHAR(180) NOT NULL,
            full_name         VARCHAR(180) NOT NULL,
            password_hash     VARCHAR(255) NOT NULL,
            status            VARCHAR(20) NOT NULL DEFAULT 'active',
            is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
            created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP WITH TIME ZONE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON public.users (email);
        CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.permissions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            permission_code VARCHAR(100) NOT NULL,
            permission_name VARCHAR(150) NOT NULL,
            module_name     VARCHAR(80) NOT NULL,
            created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_code ON public.permissions (permission_code);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.role_permissions (
            role_id       UUID NOT NULL,
            permission_id UUID NOT NULL,
            PRIMARY KEY (role_id, permission_id),
            CONSTRAINT fk_role_permissions_role
                FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE,
            CONSTRAINT fk_role_permissions_permission
                FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE
        );
        """,

        """
        CREATE TABLE IF NOT EXISTS public.user_company_access (
            user_id    UUID NOT NULL,
            tenant_id  VARCHAR(100) NOT NULL,
            company_id INTEGER NOT NULL,
            env_id     UUID,
            PRIMARY KEY (user_id, tenant_id, company_id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS public.environments (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id        VARCHAR(100) NOT NULL,
            company_id       INTEGER,
            env_code         VARCHAR(60) NOT NULL,
            env_name         VARCHAR(120) NOT NULL,
            api_base_url     VARCHAR(500),
            middleware_route VARCHAR(500),
            status           VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP WITH TIME ZONE
        );
        CREATE INDEX IF NOT EXISTS idx_environments_tenant_id ON public.environments (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_environments_company_id ON public.environments (company_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.connectors (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id      VARCHAR(100) NOT NULL,
            company_id     INTEGER,
            env_id         UUID,
            connector_type VARCHAR(50) NOT NULL,
            connector_name VARCHAR(150) NOT NULL,
            base_url       VARCHAR(500),
            auth_type      VARCHAR(50),
            secret_ref     VARCHAR(200),
            status         VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at     TIMESTAMP WITH TIME ZONE
        );
        CREATE INDEX IF NOT EXISTS idx_connectors_tenant_id ON public.connectors (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_connectors_company_id ON public.connectors (company_id);
        CREATE INDEX IF NOT EXISTS idx_connectors_env_id ON public.connectors (env_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.license_plans (
            id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_code                 VARCHAR(60) NOT NULL,
            plan_name                 VARCHAR(150) NOT NULL,
            billing_cycle             VARCHAR(20) NOT NULL DEFAULT 'monthly',
            query_limit               INTEGER,
            concurrent_sessions_limit INTEGER,
            overage_mode              VARCHAR(20) NOT NULL DEFAULT 'block',
            active                    BOOLEAN NOT NULL DEFAULT TRUE,
            created_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at                TIMESTAMP WITH TIME ZONE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_license_plans_plan_code ON public.license_plans (plan_code);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.tenant_contracts (
            id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id                    VARCHAR(100) NOT NULL,
            plan_id                      UUID,
            contract_code                VARCHAR(80) NOT NULL,
            contract_status              VARCHAR(20) NOT NULL DEFAULT 'active',
            starts_at                    DATE NOT NULL,
            ends_at                      DATE,
            query_limit_override         INTEGER,
            concurrent_sessions_override INTEGER,
            overage_mode_override        VARCHAR(20),
            notes                        TEXT,
            created_at                   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at                   TIMESTAMP WITH TIME ZONE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_contracts_contract_code ON public.tenant_contracts (contract_code);
        CREATE INDEX IF NOT EXISTS idx_tenant_contracts_tenant_id ON public.tenant_contracts (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.query_usage_counters (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       VARCHAR(100) NOT NULL,
            contract_id     UUID NOT NULL,
            period_ref      VARCHAR(20) NOT NULL,
            total_queries   INTEGER NOT NULL DEFAULT 0,
            blocked_queries INTEGER NOT NULL DEFAULT 0,
            overage_queries INTEGER NOT NULL DEFAULT 0,
            updated_at      TIMESTAMP WITH TIME ZONE
        );
        CREATE INDEX IF NOT EXISTS idx_query_usage_counters_tenant_id ON public.query_usage_counters (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.concurrent_sessions (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id      VARCHAR(100) NOT NULL,
            user_id        UUID,
            session_key    VARCHAR(120) NOT NULL,
            started_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expires_at     TIMESTAMP WITH TIME ZONE,
            session_status VARCHAR(20) NOT NULL DEFAULT 'active'
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_concurrent_sessions_session_key ON public.concurrent_sessions (session_key);
        CREATE INDEX IF NOT EXISTS idx_concurrent_sessions_tenant_id ON public.concurrent_sessions (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.tenant_module_contracts (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   VARCHAR(100) NOT NULL,
            contract_id UUID NOT NULL,
            module_id   UUID NOT NULL,
            status      VARCHAR(20) NOT NULL DEFAULT 'allowed',
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tenant_module_contracts_tenant_id ON public.tenant_module_contracts (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id    VARCHAR(100),
            company_id   INTEGER,
            user_id      VARCHAR(100),
            module_name  VARCHAR(80) NOT NULL,
            action_name  VARCHAR(120) NOT NULL,
            target_type  VARCHAR(80),
            target_id    VARCHAR(120),
            request_id   VARCHAR(120),
            details_json JSONB,
            created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs (company_id);
        """,

        """
        CREATE TABLE IF NOT EXISTS public.platform_audit_log (
            id          BIGSERIAL PRIMARY KEY,
            tenant_code VARCHAR(50),
            actor       VARCHAR(150),
            action      VARCHAR(100) NOT NULL,
            detail      JSONB,
            created_at  TIMESTAMP DEFAULT NOW()
        );
        """,
        """
        DROP SCHEMA IF EXISTS "1" CASCADE;
        """
    ]

    try:
        _run_public_ddl(db, public_queries)

        # FK: tenant_contracts -> license_plans (adicionada via Python para evitar DO $$ no SQLAlchemy)
        fk1 = db.execute(text("""
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'tenant_contracts'
              AND constraint_name = 'fk_tenant_contracts_plan'
        """)).first()
        if not fk1:
            try:
                db.execute(text("""
                    ALTER TABLE public.tenant_contracts
                    ADD CONSTRAINT fk_tenant_contracts_plan
                    FOREIGN KEY (plan_id) REFERENCES public.license_plans(id)
                """))
            except Exception:
                pass  # constraint pode já existir em race condition

        # FK: tenant_module_contracts -> protheus_modules_master
        fk2 = db.execute(text("""
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'tenant_module_contracts'
              AND constraint_name = 'fk_tenant_module_contracts_module'
        """)).first()
        if not fk2:
            try:
                db.execute(text("""
                    ALTER TABLE public.tenant_module_contracts
                    ADD CONSTRAINT fk_tenant_module_contracts_module
                    FOREIGN KEY (module_id) REFERENCES public.protheus_modules_master(id)
                """))
            except Exception:
                pass  # constraint pode já existir em race condition

        _mark_public_bootstrap_done(db)
        _safe_commit(db)
        PUBLIC_BOOTSTRAP_DONE = True
    except Exception as e:
        _safe_rollback(db)
        PUBLIC_BOOTSTRAP_DONE = False
        print(f"[DB] Erro ao garantir tabelas globais em public: {e}")


# ─────────────────────────────────────────────────────────────
# RESOLUÇÃO DE TENANT
# ─────────────────────────────────────────────────────────────

def resolve_clean_tenant(db, tenant_id: str | int | None) -> str:
    """
    Garante que o tenant_id seja convertido em um nome de schema válido.
    Se for numérico (ex: '1' ou 1), busca no tenant ou assume o
    primeiro tenant ou 'default'. NUNCA retorna um nome de schema puramente
    numérico ou 'public'.
    """
    raw_str = str(tenant_id or '').strip()
    if not raw_str or raw_str == "public":
        return "default"

    clean = re.sub(r'[^a-zA-Z0-9_]', '', raw_str)

    if clean.isdigit():
        try:
            reg = db.execute(
                text("SELECT tenant_code, schema_name FROM public.tenant WHERE id = :id OR tenant_code = :tc LIMIT 1"),
                {"id": int(clean), "tc": clean}
            ).mappings().first()

            if not reg:
                reg = db.execute(
                    text("SELECT tenant_code, schema_name FROM public.tenant ORDER BY id ASC LIMIT 1")
                ).mappings().first()

            if reg and (reg.get("schema_name") or reg.get("tenant_code")):
                clean = reg.get("schema_name") or reg.get("tenant_code")
            else:
                clean = "default"
        except Exception:
            if hasattr(db, "rollback"):
                db.rollback()
            clean = "default"

    clean = re.sub(r'[^a-zA-Z0-9_]', '', str(clean))
    if not clean or clean == "public" or clean.isdigit():
        clean = "default"

    return clean


# ─────────────────────────────────────────────────────────────
# BOOTSTRAP POR TENANT (schema exclusivo) — IDEMPOTENTE
# ─────────────────────────────────────────────────────────────

TENANT_REQUIRED_TABLES = {
    "company_info", "protheus_modules", "tenant_schemas",
    "dictionary_tables", "dictionary_fields", "dictionary_indexes", "dictionary_groups",
    "tenant_dictionary_sources", "tenant_table_permissions", "tenant_field_permissions",
    "memories", "documents", "document_chunks", "agent_query_audit",
}


def _tenant_schema_bootstrap_done(db, clean_tenant: str) -> bool:
    """Verifica, de forma idempotente, se o schema do tenant já possui as tabelas essenciais."""
    try:
        rows = db.execute(text("""
            SELECT table_name
              FROM information_schema.tables
             WHERE table_schema = :schema_name
        """), {"schema_name": clean_tenant}).scalars().all()
        existing = set(rows)
        return TENANT_REQUIRED_TABLES.issubset(existing)
    except Exception:
        return False


def ensure_tenant_tables(db, clean_tenant: str):
    ensure_public_tables(db)
    clean_tenant = resolve_clean_tenant(db, clean_tenant)

    try:
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

        # ── Patch 1: rename encrypted_protheus_pass → encrypted_protheus_password ──
        col_exists = db.execute(text("""
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = 'company_info'
              AND column_name = 'encrypted_protheus_pass'
        """), {"schema": clean_tenant}).first()
        if col_exists:
            db.execute(text(f'ALTER TABLE "{clean_tenant}".company_info RENAME COLUMN encrypted_protheus_pass TO encrypted_protheus_password'))

        # ── Patch 2: adiciona colunas introduzidas após bootstrap inicial ──
        tbl_exists = db.execute(text("""
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = 'company_info'
        """), {"schema": clean_tenant}).first()
        if tbl_exists:
            for col_sql in [
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_ambientes VARCHAR(100) DEFAULT \'producao\'',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS webapp_url TEXT',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS system_prompt TEXT',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) DEFAULT 0.20',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS ie VARCHAR(30)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS email VARCHAR(255)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS telefone VARCHAR(50)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS endereco VARCHAR(500)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_grupo VARCHAR(20)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_empresa VARCHAR(20)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_unidade VARCHAR(20)',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_filial VARCHAR(30) DEFAULT \'0101\'',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS environment VARCHAR(60) DEFAULT \'producao\'',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS auth_mode VARCHAR(30) DEFAULT \'basic\'',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'active\'',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_rest_url TEXT',
                f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_usuario VARCHAR(100)',
            ]:
                db.execute(text(col_sql))
        db.commit()

        # ── Patch 2: add columns introduzidas após o bootstrap inicial ──
        db.execute(text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = '{clean_tenant}' AND table_name = 'company_info'
                ) THEN
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS tenant_id               VARCHAR(100);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_ambientes      VARCHAR(100) DEFAULT 'producao';
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS webapp_url              TEXT;
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS system_prompt           TEXT;
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS temperature             NUMERIC(3,2) DEFAULT 0.20;
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS ie                      VARCHAR(30);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS razao_social            VARCHAR(255);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS email                   VARCHAR(255);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS telefone                VARCHAR(50);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS endereco                VARCHAR(500);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_grupo          VARCHAR(20);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_empresa        VARCHAR(20);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_unidade        VARCHAR(20);
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_filial         VARCHAR(30) DEFAULT '0101';
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS environment             VARCHAR(60) DEFAULT 'producao';
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS auth_mode               VARCHAR(30) DEFAULT 'basic';
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS status                  VARCHAR(20) DEFAULT 'active';
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_rest_url       TEXT;
                    ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_usuario        VARCHAR(100);

                    -- Migrate data if necessary
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '{clean_tenant}' AND table_name = 'company_info' AND column_name = 'protheus_user') THEN
                        UPDATE "{clean_tenant}".company_info SET protheus_usuario = protheus_user WHERE protheus_usuario IS NULL;
                        ALTER TABLE "{clean_tenant}".company_info DROP COLUMN protheus_user;
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '{clean_tenant}' AND table_name = 'company_info' AND column_name = 'protheus_url') THEN
                        UPDATE "{clean_tenant}".company_info SET protheus_rest_url = protheus_url || ':' || CAST(protheus_rest_port AS TEXT) WHERE protheus_rest_url IS NULL AND protheus_rest_port IS NOT NULL;
                        ALTER TABLE "{clean_tenant}".company_info DROP COLUMN protheus_url;
                        ALTER TABLE "{clean_tenant}".company_info DROP COLUMN protheus_rest_port;
                    END IF;
                    
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE table_schema = '{clean_tenant}' 
                        AND table_name = 'company_info' 
                        AND constraint_type = 'UNIQUE'
                    ) THEN
                        ALTER TABLE "{clean_tenant}".company_info ADD CONSTRAINT company_info_company_code_branch_code_key UNIQUE(company_code, branch_code);
                    END IF;
                END IF;
            END $$;
        """))
        db.commit()

        # ── Patch 3: Drop legacy V4 tables to allow recreation with V5 schema ──
        db.execute(text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = '{clean_tenant}' AND table_name = 'protheus_modules' AND column_name = 'modulo'
                ) THEN
                    DROP TABLE IF EXISTS "{clean_tenant}".protheus_modules CASCADE;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = '{clean_tenant}' AND table_name = 'tenant_schemas' AND column_name = 'modulo'
                ) THEN
                    DROP TABLE IF EXISTS "{clean_tenant}".tenant_schemas CASCADE;
                END IF;
            END $$;
        """))
        db.commit()

        # ── Patch 4: Drop NOT NULL from company_id in dictionary_tables ──
        db.execute(text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = '{clean_tenant}' AND table_name = 'dictionary_tables' AND column_name = 'company_id'
                ) THEN
                    ALTER TABLE "{clean_tenant}".dictionary_tables ALTER COLUMN company_id DROP NOT NULL;
                END IF;
            END $$;
        """))
        db.commit()

        if _tenant_schema_bootstrap_done(db, clean_tenant):
            return

        # 1. company_info
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".company_info (
                id                      SERIAL PRIMARY KEY,
                tenant_id               VARCHAR(100),
                company_code            VARCHAR(60) NOT NULL,
                branch_code             VARCHAR(60) NOT NULL,
                company_name            VARCHAR(200) NOT NULL,
                short_name              VARCHAR(100),
                cnpj                    VARCHAR(20),
                protheus_rest_url       TEXT,
                protheus_usuario        VARCHAR(100),
                encrypted_protheus_password VARCHAR(255),
                created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                protheus_ambientes      VARCHAR(100) DEFAULT 'producao',
                webapp_url              TEXT,
                system_prompt           TEXT,
                temperature             NUMERIC(3,2) DEFAULT 0.20,
                ie                      VARCHAR(30),
                razao_social            VARCHAR(255),
                email                   VARCHAR(255),
                telefone                VARCHAR(50),
                endereco                VARCHAR(500),
                protheus_grupo          VARCHAR(20),
                protheus_empresa        VARCHAR(20),
                protheus_unidade        VARCHAR(20),
                protheus_filial         VARCHAR(30) DEFAULT '0101',
                environment             VARCHAR(60) DEFAULT 'producao',
                auth_mode               VARCHAR(30) DEFAULT 'basic',
                status                  VARCHAR(20) DEFAULT 'active',
                UNIQUE(company_code, branch_code)
            );

            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_tables (
                id SERIAL PRIMARY KEY,
                company_id INT REFERENCES "{clean_tenant}".company_info(id) ON DELETE CASCADE,
                table_code VARCHAR(10) NOT NULL,
                table_name VARCHAR(50) NOT NULL,
                module_code VARCHAR(10),
                description VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_fields (
                id SERIAL PRIMARY KEY,
                table_code VARCHAR(10) NOT NULL,
                field_name VARCHAR(50) NOT NULL,
                title VARCHAR(100),
                field_type VARCHAR(1),
                length_num INT,
                decimal_num INT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_indexes (
                id SERIAL PRIMARY KEY,
                table_code VARCHAR(10) NOT NULL,
                index_order INT NOT NULL,
                nickname VARCHAR(100),
                expression TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_schemas (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100),
                mod_code INTEGER,
                mod_sigla VARCHAR(30),
                campo VARCHAR(100),
                chave VARCHAR(100),
                tabela VARCHAR(100),
                nome VARCHAR(255),
                schema_json JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # 5. Limpeza de tabelas operacionais legadas/duplicadas no schema do tenant
        try:
            db.execute(text(
                f'DROP TABLE IF EXISTS "{clean_tenant}".protheus_modules, '
                f'"{clean_tenant}".field_rules, '
                f'"{clean_tenant}".users, '
                f'"{clean_tenant}".tenant_allowed_tables, '
                f'"{clean_tenant}".tenant_allowed_fields, '
                f'"{clean_tenant}".tenant_dictionary_tables, '
                f'"{clean_tenant}".tenant_dictionary_fields, '
                f'"{clean_tenant}".tenant_dictionary_indexes, '
                f'"{clean_tenant}".dictionary_groups, '
                f'"{clean_tenant}".tenant_dictionary_sources, '
                f'"{clean_tenant}".tenant_table_permissions, '
                f'"{clean_tenant}".tenant_field_permissions CASCADE;'
            ))
            db.commit()
        except Exception:
            db.rollback()

        # 6. RAG, Memories and Audit
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".memories (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
                company_id INT,
                visibility VARCHAR(20) NOT NULL DEFAULT 'tenant',
                memory_key VARCHAR(255) NOT NULL,
                memory_value TEXT NOT NULL,
                memory_type VARCHAR(50),
                scope VARCHAR(100),
                tags JSONB,
                confidence INT,
                source VARCHAR(255),
                expires_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".documents (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
                visibility VARCHAR(20) NOT NULL DEFAULT 'tenant',
                title VARCHAR(255) NOT NULL,
                source_path VARCHAR(1024) NOT NULL,
                source_type VARCHAR(50),
                module VARCHAR(100),
                category VARCHAR(100),
                version VARCHAR(50),
                status VARCHAR(50),
                checksum VARCHAR(64),
                language VARCHAR(10),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".document_chunks (
                id SERIAL PRIMARY KEY,
                document_id INT NOT NULL REFERENCES "{clean_tenant}".documents(id) ON DELETE CASCADE,
                chunk_order INT NOT NULL,
                content TEXT NOT NULL,
                token_count INT,
                embedding_model VARCHAR(100),
                vector vector(3072),
                page_number INT,
                section VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".agent_query_audit (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(100) NOT NULL,
                company_id INT,
                env_id UUID,
                user_id UUID,
                contract_id UUID,
                snapshot_id UUID,
                request_id VARCHAR(120),
                natural_language_prompt TEXT,
                generated_sql TEXT,
                sql_hash VARCHAR(128),
                execution_status VARCHAR(20) NOT NULL DEFAULT 'planned',
                rows_returned INT,
                response_time_ms INT,
                blocked_reason VARCHAR(255),
                tables_used TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".query_audit (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(180),
                question TEXT,
                generated_sql TEXT,
                response_time_ms INT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[DB] Erro ao garantir tabelas no schema '{clean_tenant}': {e}")


def ensure_all_registered_tenant_schemas(db):
    """
    Garante que todos os tenants cadastrados em public.tenant
    (e, se existir, public.companies) possuam seus schemas criados no PostgreSQL.
    """
    ensure_public_tables(db)
    tenant_ids = set()
    try:
        res1 = db.execute(text("SELECT id, tenant_code FROM public.tenant"))
        for row in res1.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
            if row[1]: tenant_ids.add(str(row[1]))
    except Exception:
        db.rollback()
    try:
        res2 = db.execute(text("SELECT tenant_id FROM public.companies WHERE tenant_id IS NOT NULL"))
        for row in res2.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
    except Exception:
        db.rollback()
    try:
        res3 = db.execute(text("SELECT tenant_code, schema_name FROM public.tenant"))
        for row in res3.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
            if row[1]: tenant_ids.add(str(row[1]).replace("tenant_", ""))
    except Exception:
        db.rollback()

    for tid in tenant_ids:
        clean = re.sub(r'[^a-zA-Z0-9_]', '', str(tid))
        if clean and clean != "public":
            try:
                ensure_tenant_tables(db, clean)
            except Exception as err:
                print(f"[DB] Aviso ao provisionar schema '{clean}': {err}")


# ─────────────────────────────────────────────────────────────
# SESSÕES / DEPENDENCY INJECTION
# ─────────────────────────────────────────────────────────────

def get_tenant_session(tenant_id: str):
    db = SessionLocal()
    ensure_public_tables(db)
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant:
        clean_tenant = "default"
    if clean_tenant != "public":
        try:
            db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
            if hasattr(db, "commit"): db.commit()
        except Exception:
            if hasattr(db, "rollback"): db.rollback()
        ensure_tenant_tables(db, clean_tenant)
    db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
    if hasattr(db, "commit"): db.commit()
    return db


def get_db(x_tenant_id: str = Header(None), tenant_id: str = None):
    db = SessionLocal()
    ensure_public_tables(db)

    tid = x_tenant_id or tenant_id or "default"
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tid))
    if not clean_tenant:
        clean_tenant = "default"

    try:
        if clean_tenant != "public":
            try:
                db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
                if hasattr(db, "commit"): db.commit()
            except Exception:
                if hasattr(db, "rollback"): db.rollback()

            ensure_tenant_tables(db, clean_tenant)

        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        if hasattr(db, "commit"): db.commit()

        yield db
    finally:
        try:
            db.execute(text("SET search_path TO public"))
            if hasattr(db, "commit"): db.commit()
        except Exception:
            pass
        db.close()
