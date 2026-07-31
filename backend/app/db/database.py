"""
database.py — Copilot Protheus V4
Estratégia: multi-tenancy por schema PostgreSQL.

Schema public  → tabelas globais de plataforma (imutáveis, nunca destruídas).
Schema {tenant} → tabelas isoladas por empresa/tenant (criadas sob demanda).

REGRAS CRÍTICAS:
  1. NUNCA executar DROP TABLE em produção neste arquivo.
  2. Toda criação de tabela usa CREATE TABLE IF NOT EXISTS (idempotente).
  3. Toda adição de coluna usa ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
  4. O Alembic é a autoridade para migrações estruturais — este arquivo apenas
     garante a existência mínima das tabelas no boot.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from fastapi import Header
import os
import re


# ─────────────────────────────────────────────────────────────
# ENGINE
# ─────────────────────────────────────────────────────────────

def ensure_database_exists(db_url: str):
    if not db_url or "sqlite" in db_url:
        return
    try:
        from sqlalchemy.engine.url import make_url
        url = make_url(db_url)
        target_db = url.database
        if not target_db or target_db == "postgres":
            return
        default_url = url._replace(database="postgres")
        tmp_engine = create_engine(default_url, isolation_level="AUTOCOMMIT")
        with tmp_engine.connect() as conn:
            res = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": target_db},
            ).scalar()
            if not res:
                conn.execute(text(f'CREATE DATABASE "{target_db}"'))
                print(f"[DB] Banco de dados '{target_db}' criado com sucesso!")
        tmp_engine.dispose()
    except Exception as e:
        print(f"[DB] Aviso ao verificar/criar banco de dados: {e}")


DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or "sqlite:///:memory:"

try:
    ensure_database_exists(DATABASE_URL)
except Exception:
    pass

engine_args: dict = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import StaticPool
    engine_args = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─────────────────────────────────────────────────────────────
# HELPER DDL IDEMPOTENTE
# ─────────────────────────────────────────────────────────────

def _exec(db, sql: str, params: dict | None = None):
    """Executa DDL com rollback silencioso. Nunca lança exceção."""
    try:
        db.execute(text(sql), params or {})
        if hasattr(db, "commit"):
            db.commit()
    except Exception as err:
        try:
            if hasattr(db, "rollback"):
                db.rollback()
        except Exception:
            pass
        msg = str(err).lower()
        if "already exists" not in msg and "duplicate" not in msg:
            print(f"[DB] DDL warning: {err}")


# ─────────────────────────────────────────────────────────────
# SCHEMA PUBLIC — TABELAS GLOBAIS DE PLATAFORMA
# ─────────────────────────────────────────────────────────────

def ensure_public_tables(db):
    """
    Garante a existência de TODAS as tabelas globais no schema public.
    100% idempotente — NUNCA destrói dados existentes.
    """

    # Extensions
    _exec(db, "CREATE SCHEMA IF NOT EXISTS public")
    _exec(db, "CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public")
    _exec(db, "CREATE EXTENSION IF NOT EXISTS vector  SCHEMA public")

    # ── tenant_registry ──────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.tenant_registry (
            id                SERIAL PRIMARY KEY,
            tenant_code       VARCHAR(50)  UNIQUE NOT NULL,
            tenant_name       VARCHAR(150) NOT NULL,
            schema_name       VARCHAR(63)  UNIQUE NOT NULL,
            status            VARCHAR(20)  NOT NULL DEFAULT 'provisioning',
            plan_code         VARCHAR(50),
            created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            provisioned_at    TIMESTAMP WITH TIME ZONE,
            decommissioned_at TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "ALTER TABLE public.tenant_registry ALTER COLUMN updated_at DROP NOT NULL")

    # ── plans ────────────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.plans (
            plan_code       VARCHAR(50) PRIMARY KEY,
            plan_name       VARCHAR(150) NOT NULL,
            max_users       INTEGER DEFAULT 5,
            max_queries_day INTEGER DEFAULT 500,
            modules_allowed JSONB   DEFAULT '[]',
            active          BOOLEAN DEFAULT TRUE
        )
    """)

    # ── license_plans ────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.license_plans (
            id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_code                 VARCHAR(60)  UNIQUE NOT NULL,
            plan_name                 VARCHAR(150) NOT NULL,
            billing_cycle             VARCHAR(20)  NOT NULL DEFAULT 'monthly',
            query_limit               INTEGER,
            concurrent_sessions_limit INTEGER,
            overage_mode              VARCHAR(20)  NOT NULL DEFAULT 'block',
            active                    BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at                TIMESTAMP WITH TIME ZONE
        )
    """)

    # ── tenant_contracts ─────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.tenant_contracts (
            id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id                    VARCHAR(100) NOT NULL,
            plan_id                      UUID REFERENCES public.license_plans(id),
            contract_code                VARCHAR(80)  UNIQUE NOT NULL,
            contract_status              VARCHAR(20)  NOT NULL DEFAULT 'active',
            starts_at                    DATE NOT NULL,
            ends_at                      DATE,
            query_limit_override         INTEGER,
            concurrent_sessions_override INTEGER,
            overage_mode_override        VARCHAR(20),
            notes                        TEXT,
            created_at                   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at                   TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_tenant_contracts_tenant ON public.tenant_contracts (tenant_id)")

    # ── query_usage_counters ──────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.query_usage_counters (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       VARCHAR(100) NOT NULL,
            contract_id     UUID NOT NULL,
            period_ref      VARCHAR(20)  NOT NULL,
            total_queries   INTEGER NOT NULL DEFAULT 0,
            blocked_queries INTEGER NOT NULL DEFAULT 0,
            overage_queries INTEGER NOT NULL DEFAULT 0,
            updated_at      TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_quc_tenant ON public.query_usage_counters (tenant_id)")

    # ── concurrent_sessions ───────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.concurrent_sessions (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id      VARCHAR(100) NOT NULL,
            user_id        UUID,
            session_key    VARCHAR(120) UNIQUE NOT NULL,
            started_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at     TIMESTAMP WITH TIME ZONE,
            session_status VARCHAR(20)  NOT NULL DEFAULT 'active'
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_cs_tenant ON public.concurrent_sessions (tenant_id)")

    # ── users ─────────────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.users (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id         VARCHAR(100),
            email             VARCHAR(180) UNIQUE NOT NULL,
            full_name         VARCHAR(180) NOT NULL,
            password_hash     VARCHAR(255) NOT NULL,
            status            VARCHAR(20)  NOT NULL DEFAULT 'active',
            is_platform_admin BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at        TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users (tenant_id)")
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_users_email  ON public.users (email)")

    # ── roles ─────────────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.roles (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            role_code   VARCHAR(60)  UNIQUE NOT NULL,
            role_name   VARCHAR(120) NOT NULL,
            scope_level VARCHAR(30)  NOT NULL DEFAULT 'tenant',
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # ── permissions ───────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.permissions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            permission_code VARCHAR(100) UNIQUE NOT NULL,
            permission_name VARCHAR(150) NOT NULL,
            module_name     VARCHAR(80)  NOT NULL,
            created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # ── role_permissions (m2m) ────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.role_permissions (
            role_id       UUID REFERENCES public.roles(id)       ON DELETE CASCADE,
            permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        )
    """)

    # ── user_roles (m2m) ─────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.user_roles (
            user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
            role_id    UUID REFERENCES public.roles(id) ON DELETE CASCADE,
            tenant_id  VARCHAR(100) NOT NULL,
            company_id INTEGER,
            PRIMARY KEY (user_id, role_id, tenant_id)
        )
    """)

    # ── user_company_access ───────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.user_company_access (
            user_id    UUID        NOT NULL,
            tenant_id  VARCHAR(100) NOT NULL,
            company_id INTEGER     NOT NULL,
            env_id     UUID,
            PRIMARY KEY (user_id, tenant_id, company_id)
        )
    """)

    # ── environments ──────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.environments (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id        VARCHAR(100) NOT NULL,
            company_id       INTEGER,
            env_code         VARCHAR(60)  NOT NULL,
            env_name         VARCHAR(120) NOT NULL,
            api_base_url     VARCHAR(500),
            middleware_route VARCHAR(500),
            status           VARCHAR(20)  NOT NULL DEFAULT 'active',
            created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at       TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_environments_tenant ON public.environments (tenant_id)")

    # ── connectors ────────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.connectors (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id      VARCHAR(100) NOT NULL,
            company_id     INTEGER,
            env_id         UUID,
            connector_type VARCHAR(50)  NOT NULL,
            connector_name VARCHAR(150) NOT NULL,
            base_url       VARCHAR(500),
            auth_type      VARCHAR(50),
            secret_ref     VARCHAR(200),
            status         VARCHAR(20)  NOT NULL DEFAULT 'active',
            created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at     TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON public.connectors (tenant_id)")

    # ── protheus_modules_master ───────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.protheus_modules_master (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mod_code    VARCHAR(30) UNIQUE,
            module_code VARCHAR(30) UNIQUE,
            mod_name    VARCHAR(150),
            module_name VARCHAR(150),
            description TEXT,
            source_name VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE',
            active      BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at  TIMESTAMP WITH TIME ZONE
        )
    """)
    for sql in [
        "ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS mod_code    VARCHAR(30)",
        "ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS mod_name    VARCHAR(150)",
        "ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS module_code VARCHAR(30)",
        "ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS module_name VARCHAR(150)",
        "UPDATE public.protheus_modules_master SET mod_code    = module_code WHERE mod_code    IS NULL AND module_code IS NOT NULL",
        "UPDATE public.protheus_modules_master SET mod_name    = module_name WHERE mod_name    IS NULL AND module_name IS NOT NULL",
        "UPDATE public.protheus_modules_master SET module_code = mod_code    WHERE module_code IS NULL AND mod_code    IS NOT NULL",
        "UPDATE public.protheus_modules_master SET module_name = mod_name    WHERE module_name IS NULL AND mod_name    IS NOT NULL",
        "DELETE FROM public.protheus_modules_master WHERE source_name = 'fallback_hardcoded'",
    ]:
        _exec(db, sql)

    # ── tenant_module_contracts ───────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.tenant_module_contracts (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   VARCHAR(100) NOT NULL,
            contract_id UUID NOT NULL,
            module_id   UUID NOT NULL REFERENCES public.protheus_modules_master(id),
            status      VARCHAR(20)  NOT NULL DEFAULT 'allowed',
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_tmc_tenant ON public.tenant_module_contracts (tenant_id)")

    # ── audit_logs ────────────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id    VARCHAR(100),
            company_id   INTEGER,
            user_id      VARCHAR(100),
            module_name  VARCHAR(80)  NOT NULL,
            action_name  VARCHAR(120) NOT NULL,
            target_type  VARCHAR(80),
            target_id    VARCHAR(120),
            request_id   VARCHAR(120),
            details_json JSONB,
            created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id)")

    # ── platform_admins ───────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.platform_admins (
            id            SERIAL PRIMARY KEY,
            email         VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_superadmin BOOLEAN DEFAULT FALSE,
            active        BOOLEAN DEFAULT TRUE,
            created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # ── agent_users (legado — mantido por compatibilidade) ────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.agent_users (
            id            SERIAL PRIMARY KEY,
            tenant_id     VARCHAR(100) NOT NULL DEFAULT 'default',
            username      VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role          VARCHAR(50)  DEFAULT 'user',
            created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    _exec(db, "ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default'")

    # ── agent_roles (legado — mantido por compatibilidade) ────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.agent_roles (
            id         SERIAL PRIMARY KEY,
            tenant_id  VARCHAR(100) NOT NULL DEFAULT 'default',
            name       VARCHAR(50)  NOT NULL,
            permissions JSON,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    _exec(db, "ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default'")

    # ── platform_audit_log ────────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.platform_audit_log (
            id          BIGSERIAL PRIMARY KEY,
            tenant_code VARCHAR(50),
            actor       VARCHAR(150),
            action      VARCHAR(100) NOT NULL,
            detail      JSONB,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # ── onboarding_projects ───────────────────────────────────
    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.onboarding_projects (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           VARCHAR(100) NOT NULL,
            company_id          INTEGER,
            project_code        VARCHAR(60)  NOT NULL,
            project_name        VARCHAR(180) NOT NULL,
            onboarding_status   VARCHAR(30)  NOT NULL DEFAULT 'planned',
            go_live_target_date DATE,
            owner_name          VARCHAR(180),
            owner_email         VARCHAR(180),
            created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at          TIMESTAMP WITH TIME ZONE
        )
    """)
    _exec(db, "CREATE INDEX IF NOT EXISTS idx_op_tenant ON public.onboarding_projects (tenant_id)")

    _exec(db, """
        CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            onboarding_project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
            task_code             VARCHAR(80)  NOT NULL,
            task_name             VARCHAR(200) NOT NULL,
            task_type             VARCHAR(50)  NOT NULL,
            mandatory             BOOLEAN      NOT NULL DEFAULT TRUE,
            task_status           VARCHAR(30)  NOT NULL DEFAULT 'pending',
            assigned_to           VARCHAR(180),
            due_date              DATE,
            created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at            TIMESTAMP WITH TIME ZONE
        )
    """)

    # ── Limpeza de schema numérico inválido (artefato de bug) ─
    _exec(db, 'DROP SCHEMA IF EXISTS "1" CASCADE')


# ─────────────────────────────────────────────────────────────
# RESOLVE CLEAN TENANT
# ─────────────────────────────────────────────────────────────

def resolve_clean_tenant(db, tenant_id: str | int | None) -> str:
    raw_str = str(tenant_id or "").strip()
    if not raw_str or raw_str == "public":
        return "default"

    clean = re.sub(r"[^a-zA-Z0-9_]", "", raw_str)

    if clean.isdigit():
        try:
            reg = db.execute(
                text(
                    "SELECT tenant_code, schema_name FROM public.tenant_registry "
                    "WHERE id = :id OR tenant_code = :tc LIMIT 1"
                ),
                {"id": int(clean), "tc": clean},
            ).mappings().first()
            if not reg:
                reg = db.execute(
                    text("SELECT tenant_code, schema_name FROM public.tenant_registry ORDER BY id ASC LIMIT 1")
                ).mappings().first()
            if reg and (reg.get("schema_name") or reg.get("tenant_code")):
                clean = reg.get("schema_name") or reg.get("tenant_code")
            else:
                clean = "default"
        except Exception:
            clean = "default"

    clean = re.sub(r"[^a-zA-Z0-9_]", "", str(clean))
    if not clean or clean == "public" or clean.isdigit():
        clean = "default"
    return clean


# ─────────────────────────────────────────────────────────────
# SCHEMA TENANT — TABELAS ISOLADAS POR EMPRESA
# ─────────────────────────────────────────────────────────────

def ensure_tenant_tables(db, clean_tenant: str):
    """
    Garante a existência de todas as tabelas operacionais no schema exclusivo do tenant.
    100% idempotente — NUNCA destrói dados existentes.
    """
    ensure_public_tables(db)
    clean_tenant = resolve_clean_tenant(db, clean_tenant)

    try:
        _exec(db, f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"')
        _exec(db, f'SET search_path TO "{clean_tenant}", public')

        # ── 1. company_info ───────────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".company_info (
                id                          SERIAL PRIMARY KEY,
                tenant_id                   VARCHAR(100),
                company_code                VARCHAR(60)  NOT NULL,
                branch_code                 VARCHAR(60)  NOT NULL,
                company_name                VARCHAR(200) NOT NULL,
                cnpj                        VARCHAR(30),
                ie                          VARCHAR(30),
                razao_social                VARCHAR(255),
                email                       VARCHAR(255),
                telefone                    VARCHAR(50),
                endereco                    VARCHAR(500),
                protheus_grupo              VARCHAR(20),
                protheus_empresa            VARCHAR(20),
                protheus_unidade            VARCHAR(20),
                protheus_filial             VARCHAR(30),
                environment                 VARCHAR(60)  DEFAULT 'producao',
                protheus_ambientes          VARCHAR(100) DEFAULT 'producao',
                webapp_url                  TEXT,
                protheus_rest_url           TEXT,
                protheus_webapp_url         TEXT,
                protheus_usuario            VARCHAR(100),
                encrypted_protheus_password TEXT,
                auth_mode                   VARCHAR(30)  DEFAULT 'basic',
                status                      VARCHAR(20)  DEFAULT 'active',
                system_prompt               TEXT,
                temperature                 NUMERIC(3,2) DEFAULT 0.20,
                created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE (company_code, branch_code)
            )
        """)
        for col_sql in [
            f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS protheus_webapp_url TEXT',
            f'ALTER TABLE "{clean_tenant}".company_info ADD COLUMN IF NOT EXISTS webapp_url TEXT',
            f"ALTER TABLE \"{clean_tenant}\".company_info ADD COLUMN IF NOT EXISTS protheus_ambientes VARCHAR(100) DEFAULT 'producao'",
        ]:
            _exec(db, col_sql)

        # ── 2. protheus_modules ───────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".protheus_modules (
                id           SERIAL PRIMARY KEY,
                tenant_id    VARCHAR(100) NOT NULL,
                company_code VARCHAR(60),
                modulo       VARCHAR(50)  NOT NULL DEFAULT '',
                codmod       VARCHAR(50)  NOT NULL DEFAULT '',
                usr_modulo   VARCHAR(50),
                usr_codmod   VARCHAR(50),
                usr_nome     VARCHAR(255),
                created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        for s in [
            f'ALTER TABLE "{clean_tenant}".protheus_modules ADD COLUMN IF NOT EXISTS modulo VARCHAR(50)',
            f'ALTER TABLE "{clean_tenant}".protheus_modules ADD COLUMN IF NOT EXISTS codmod VARCHAR(50)',
            f'UPDATE "{clean_tenant}".protheus_modules SET modulo = usr_modulo WHERE modulo IS NULL AND usr_modulo IS NOT NULL',
            f'UPDATE "{clean_tenant}".protheus_modules SET codmod = usr_codmod WHERE codmod IS NULL AND usr_codmod IS NOT NULL',
            f'DROP INDEX IF EXISTS "{clean_tenant}".idx_{clean_tenant}_pm_usr_modulo',
            f'DROP INDEX IF EXISTS "{clean_tenant}".idx_{clean_tenant}_pm_usr_codmod',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_tenant ON "{clean_tenant}".protheus_modules (tenant_id)',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_modulo ON "{clean_tenant}".protheus_modules (modulo)',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_codmod ON "{clean_tenant}".protheus_modules (codmod)',
        ]:
            _exec(db, s)

        # ── 3. tenant_schemas ─────────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_schemas (
                id          SERIAL PRIMARY KEY,
                tenant_id   VARCHAR(100) NOT NULL,
                modulo      VARCHAR(50)  NOT NULL,
                codmod      VARCHAR(50),
                chave       VARCHAR(10)  NOT NULL,
                tabela      VARCHAR(50),
                nome        VARCHAR(255),
                schema_json JSONB NOT NULL,
                created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        for s in [
            f'ALTER TABLE "{clean_tenant}".tenant_schemas ADD COLUMN IF NOT EXISTS codmod VARCHAR(50)',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_tenant ON "{clean_tenant}".tenant_schemas (tenant_id)',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_modulo ON "{clean_tenant}".tenant_schemas (modulo)',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_codmod ON "{clean_tenant}".tenant_schemas (codmod)',
            f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_chave  ON "{clean_tenant}".tenant_schemas (chave)',
        ]:
            _exec(db, s)

        # ── 4. dictionary_tables ──────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_tables (
                id             BIGSERIAL PRIMARY KEY,
                tenant_id      VARCHAR(100) NOT NULL,
                company_id     VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code  VARCHAR(60)  NOT NULL,
                table_name     VARCHAR(30)  NOT NULL,
                table_alias    VARCHAR(80),
                module_code    VARCHAR(10),
                description    TEXT,
                physical_name  VARCHAR(80),
                active_flag    BOOLEAN NOT NULL DEFAULT TRUE,
                raw_payload    JSONB,
                created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_{clean_tenant}_dt UNIQUE (tenant_id, environment_id, snapshot_code, table_name)
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_dt_lookup ON "{clean_tenant}".dictionary_tables (tenant_id, environment_id, table_name)')

        # ── 5. dictionary_fields ──────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_fields (
                id              BIGSERIAL PRIMARY KEY,
                tenant_id       VARCHAR(100) NOT NULL,
                company_id      VARCHAR(100),
                environment_id  VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code   VARCHAR(60)  NOT NULL,
                table_name      VARCHAR(30)  NOT NULL,
                field_name      VARCHAR(30)  NOT NULL,
                title           VARCHAR(120),
                field_type      VARCHAR(5),
                length_num      INT,
                decimal_num     INT,
                required_flag   BOOLEAN NOT NULL DEFAULT FALSE,
                browse_flag     BOOLEAN NOT NULL DEFAULT FALSE,
                virtual_flag    BOOLEAN NOT NULL DEFAULT FALSE,
                validation_rule TEXT,
                relation_rule   TEXT,
                when_rule       TEXT,
                raw_payload     JSONB,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_{clean_tenant}_df UNIQUE (tenant_id, environment_id, snapshot_code, table_name, field_name)
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_df_lookup ON "{clean_tenant}".dictionary_fields (tenant_id, environment_id, table_name, field_name)')

        # ── 6. dictionary_indexes ─────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_indexes (
                id             BIGSERIAL PRIMARY KEY,
                tenant_id      VARCHAR(100) NOT NULL,
                company_id     VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code  VARCHAR(60)  NOT NULL,
                table_name     VARCHAR(30)  NOT NULL,
                index_order    VARCHAR(10)  NOT NULL,
                nickname       VARCHAR(80),
                expression     TEXT,
                raw_payload    JSONB,
                created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_{clean_tenant}_di UNIQUE (tenant_id, environment_id, snapshot_code, table_name, index_order)
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_di_lookup ON "{clean_tenant}".dictionary_indexes (tenant_id, environment_id, table_name)')

        # ── 7. dictionary_groups ──────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_groups (
                id             BIGSERIAL PRIMARY KEY,
                tenant_id      VARCHAR(100) NOT NULL,
                company_id     VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code  VARCHAR(60)  NOT NULL,
                group_name     VARCHAR(80)  NOT NULL,
                description    TEXT,
                raw_payload    JSONB,
                created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_{clean_tenant}_dg UNIQUE (tenant_id, environment_id, snapshot_code, group_name)
            )
        """)

        # ── 8. tenant_dictionary_sources ──────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_dictionary_sources (
                id             BIGSERIAL PRIMARY KEY,
                tenant_id      VARCHAR(100) NOT NULL,
                company_id     VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                source_type    VARCHAR(20)  NOT NULL,
                snapshot_code  VARCHAR(60)  NOT NULL,
                status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
                created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                started_at     TIMESTAMP WITH TIME ZONE,
                finished_at    TIMESTAMP WITH TIME ZONE,
                error_message  TEXT
            )
        """)

        # ── 9. tenant_table_permissions ───────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_table_permissions (
                id             BIGSERIAL PRIMARY KEY,
                tenant_id      VARCHAR(100) NOT NULL,
                company_id     VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                role_id        VARCHAR(100) NOT NULL,
                table_name     VARCHAR(30)  NOT NULL,
                can_list       BOOLEAN NOT NULL DEFAULT FALSE,
                can_describe   BOOLEAN NOT NULL DEFAULT FALSE,
                can_query      BOOLEAN NOT NULL DEFAULT FALSE,
                approved_by    VARCHAR(100),
                created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_{clean_tenant}_ttp UNIQUE (tenant_id, environment_id, role_id, table_name)
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ttp_lookup ON "{clean_tenant}".tenant_table_permissions (tenant_id, environment_id, role_id, table_name)')

        # ── 10. tenant_field_permissions ──────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_field_permissions (
                id             BIGSERIAL PRIMARY KEY,
                tenant_id      VARCHAR(100) NOT NULL,
                company_id     VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                role_id        VARCHAR(100) NOT NULL,
                table_name     VARCHAR(30)  NOT NULL,
                field_name     VARCHAR(30)  NOT NULL,
                can_select     BOOLEAN NOT NULL DEFAULT FALSE,
                can_filter     BOOLEAN NOT NULL DEFAULT FALSE,
                masked_flag    BOOLEAN NOT NULL DEFAULT FALSE,
                approved_by    VARCHAR(100),
                created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_{clean_tenant}_tfp UNIQUE (tenant_id, environment_id, role_id, table_name, field_name)
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_tfp_lookup ON "{clean_tenant}".tenant_field_permissions (tenant_id, environment_id, role_id, table_name, field_name)')

        # ── 11. memories ──────────────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".memories (
                id           SERIAL PRIMARY KEY,
                tenant_id    VARCHAR(100) NOT NULL DEFAULT 'default',
                company_id   INT,
                visibility   VARCHAR(20)  NOT NULL DEFAULT 'tenant',
                memory_key   VARCHAR(255) NOT NULL,
                memory_value TEXT NOT NULL,
                memory_type  VARCHAR(50),
                scope        VARCHAR(100),
                tags         JSONB,
                confidence   INT,
                source       VARCHAR(255),
                expires_at   TIMESTAMP WITH TIME ZONE,
                created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_mem_key ON "{clean_tenant}".memories (memory_key)')
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_mem_vis ON "{clean_tenant}".memories (visibility)')

        # ── 12. documents ─────────────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".documents (
                id          SERIAL PRIMARY KEY,
                tenant_id   VARCHAR(100) NOT NULL DEFAULT 'default',
                visibility  VARCHAR(20)  NOT NULL DEFAULT 'tenant',
                title       VARCHAR(255) NOT NULL,
                source_path VARCHAR(1024) NOT NULL,
                source_type VARCHAR(50),
                module      VARCHAR(100),
                category    VARCHAR(100),
                version     VARCHAR(50),
                status      VARCHAR(50),
                checksum    VARCHAR(64) UNIQUE,
                language    VARCHAR(10),
                created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_doc_vis ON "{clean_tenant}".documents (visibility)')
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_doc_chk ON "{clean_tenant}".documents (checksum)')

        # ── 13. document_chunks ───────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".document_chunks (
                id              SERIAL PRIMARY KEY,
                document_id     INT NOT NULL,
                chunk_order     INT NOT NULL,
                content         TEXT NOT NULL,
                token_count     INT,
                embedding_model VARCHAR(100),
                vector          vector(3072),
                page_number     INT,
                section         VARCHAR(255),
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_dc_doc ON "{clean_tenant}".document_chunks (document_id)')

        # ── 14. agent_query_audit ─────────────────────────────
        _exec(db, f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".agent_query_audit (
                id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id               VARCHAR(100) NOT NULL,
                company_id              INT,
                env_id                  UUID,
                user_id                 UUID,
                contract_id             UUID,
                snapshot_id             UUID,
                request_id              VARCHAR(120),
                natural_language_prompt TEXT,
                generated_sql           TEXT,
                sql_hash                VARCHAR(128),
                execution_status        VARCHAR(20)  NOT NULL DEFAULT 'planned',
                rows_returned           INT,
                response_time_ms        INT,
                blocked_reason          VARCHAR(255),
                tables_used             TEXT,
                created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_aqa_tenant ON "{clean_tenant}".agent_query_audit (tenant_id)')
        _exec(db, f'CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_aqa_hash   ON "{clean_tenant}".agent_query_audit (sql_hash)')

        db.commit()

    except Exception as e:
        db.rollback()
        print(f"[DB] Erro ao garantir tabelas no schema '{clean_tenant}': {e}")


# ─────────────────────────────────────────────────────────────
# PROVISIONAMENTO DE TODOS OS TENANTS CADASTRADOS
# ─────────────────────────────────────────────────────────────

def ensure_all_registered_tenant_schemas(db):
    ensure_public_tables(db)
    tenant_ids: set[str] = set()
    try:
        res = db.execute(text("SELECT tenant_code, schema_name FROM public.tenant_registry"))
        for row in res.fetchall():
            if row[0]:
                tenant_ids.add(str(row[0]))
            if row[1]:
                tenant_ids.add(str(row[1]))
    except Exception:
        pass

    for tid in tenant_ids:
        clean = re.sub(r"[^a-zA-Z0-9_]", "", str(tid))
        if clean and clean != "public" and not clean.isdigit():
            try:
                ensure_tenant_tables(db, clean)
            except Exception as err:
                print(f"[DB] Aviso ao provisionar schema '{clean}': {err}")


# ─────────────────────────────────────────────────────────────
# SESSÕES
# ─────────────────────────────────────────────────────────────

def get_tenant_session(tenant_id: str):
    db = SessionLocal()
    ensure_public_tables(db)
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    ensure_tenant_tables(db, clean_tenant)
    db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
    if hasattr(db, "commit"):
        db.commit()
    return db


def get_db(x_tenant_id: str = Header(None), tenant_id: str = None):
    """
    Dependency FastAPI.
    - Lê o tenant do header X-Tenant-Id ou do parâmetro tenant_id.
    - Define search_path antes do yield.
    - Restaura search_path para public no finally.
    - Emite warning de log se nenhum tenant for informado.
    """
    import logging
    logger = logging.getLogger("app.db.database")

    db = SessionLocal()
    ensure_public_tables(db)

    tid = x_tenant_id or tenant_id or "default"
    clean_tenant = resolve_clean_tenant(db, tid)
    if not clean_tenant:
        clean_tenant = "default"

    if clean_tenant == "default" and not x_tenant_id and not tenant_id:
        logger.warning(
            "get_db chamado sem X-Tenant-Id — usando schema 'default'. "
            "Verifique se o header está sendo enviado corretamente."
        )

    try:
        ensure_tenant_tables(db, clean_tenant)
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        if hasattr(db, "commit"):
            db.commit()
        yield db
    finally:
        try:
            db.execute(text("SET search_path TO public"))
            if hasattr(db, "commit"):
                db.commit()
        except Exception:
            pass
        db.close()
