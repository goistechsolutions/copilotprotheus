from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from fastapi import Header, Request
import os
import re

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
Base = declarative_base()

PUBLIC_BOOTSTRAP_FLAG = "public_schema_v4"
PUBLIC_BOOTSTRAP_DONE = False

PUBLIC_REQUIRED_TABLES = {
    "app_bootstrap_flags",
    "tenant_registry",
    "plans",
    "platform_admins",
    "protheus_modules_master",
    "users",
    "roles",
    "permissions",
    "environments",
    "connectors",
    "license_plans",
    "tenant_contracts",
    "query_usage_counters",
    "concurrent_sessions",
    "tenant_module_contracts",
    "audit_logs",
    "agent_users",
    "agent_roles",
    "agent_query_audit",
    "platform_audit_log",
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
    for stmt in statements:
        db.execute(text(stmt))

def ensure_public_tables(db, force: bool = False):
    global PUBLIC_BOOTSTRAP_DONE

    if DATABASE_URL.startswith("sqlite"):
        PUBLIC_BOOTSTRAP_DONE = True
        return

    if PUBLIC_BOOTSTRAP_DONE and not force:
        return

    try:
        db.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public"))
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
        _ensure_bootstrap_flags_table(db)
        _safe_commit(db)
    except Exception as e:
        _safe_rollback(db)
        print(f"[DB] Aviso ao preparar schema public: {e}")
        return

    try:
        if not force and _is_public_bootstrap_done(db):
            PUBLIC_BOOTSTRAP_DONE = True
            return
    except Exception:
        _safe_rollback(db)

    public_queries = [
        """
        CREATE TABLE IF NOT EXISTS public.tenant_registry (
            id                SERIAL PRIMARY KEY,
            tenant_code       VARCHAR(50) UNIQUE NOT NULL CHECK (tenant_code ~ '^[a-z0-9_]+$'),
            tenant_name       VARCHAR(150) NOT NULL,
            schema_name       VARCHAR(63) UNIQUE NOT NULL,
            status            VARCHAR(20) NOT NULL DEFAULT 'provisioning'
                              CHECK (status IN ('provisioning','active','suspended','decommissioned')),
            plan_code         VARCHAR(50),
            created_at        TIMESTAMP DEFAULT NOW(),
            updated_at        TIMESTAMP DEFAULT NOW(),
            provisioned_at    TIMESTAMP,
            decommissioned_at TIMESTAMP
        );
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS tenant_code       VARCHAR(50);
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS tenant_name       VARCHAR(150);
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS schema_name       VARCHAR(63);
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS status            VARCHAR(20);
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS plan_code         VARCHAR(50);
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS created_at        TIMESTAMP DEFAULT NOW();
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP DEFAULT NOW();
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS provisioned_at    TIMESTAMP;
        ALTER TABLE public.tenant_registry ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMP;
        ALTER TABLE public.tenant_registry ALTER COLUMN updated_at DROP NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_registry_tenant_code ON public.tenant_registry (tenant_code);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_registry_schema_name ON public.tenant_registry (schema_name);
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
        ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS plan_name       VARCHAR(150);
        ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_users       INTEGER DEFAULT 5;
        ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_queries_day INTEGER DEFAULT 500;
        ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS modules_allowed JSONB DEFAULT '[]';
        ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS active          BOOLEAN DEFAULT TRUE;
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
        ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS email         VARCHAR(150);
        ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS active        BOOLEAN DEFAULT TRUE;
        ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP DEFAULT NOW();
        CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_admins_email ON public.platform_admins (email);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.protheus_modules_master (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mod_code    VARCHAR(30) UNIQUE,
            module_code VARCHAR(30) UNIQUE,
            mod_name    VARCHAR(150),
            module_name VARCHAR(150),
            description TEXT,
            source_name VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE',
            active      BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP WITH TIME ZONE
        );
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS mod_code    VARCHAR(30);
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS module_code VARCHAR(30);
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS mod_name    VARCHAR(150);
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS module_name VARCHAR(150);
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS source_name VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE';
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS active      BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.protheus_modules_master ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP WITH TIME ZONE;
        UPDATE public.protheus_modules_master SET mod_code    = module_code WHERE mod_code    IS NULL AND module_code IS NOT NULL;
        UPDATE public.protheus_modules_master SET mod_name    = module_name WHERE mod_name    IS NULL AND module_name IS NOT NULL;
        UPDATE public.protheus_modules_master SET module_code = mod_code    WHERE module_code IS NULL AND mod_code    IS NOT NULL;
        UPDATE public.protheus_modules_master SET module_name = mod_name    WHERE module_name IS NULL AND mod_name    IS NOT NULL;
        DELETE FROM public.protheus_modules_master WHERE source_name = 'fallback_hardcoded';
        """,
        """
        CREATE TABLE IF NOT EXISTS public.users (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id         VARCHAR(100),
            email             VARCHAR(180) NOT NULL,
            full_name         VARCHAR(180) NOT NULL,
            password_hash     VARCHAR(255) NOT NULL,
            status            VARCHAR(20) NOT NULL DEFAULT 'active',
            is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
            created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP WITH TIME ZONE
        );
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id         VARCHAR(100);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email             VARCHAR(180);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name         VARCHAR(180);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash     VARCHAR(255);
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status            VARCHAR(20) NOT NULL DEFAULT 'active';
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP WITH TIME ZONE;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON public.users (email);
        CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.roles (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            role_code   VARCHAR(60) NOT NULL,
            role_name   VARCHAR(120) NOT NULL,
            scope_level VARCHAR(30) NOT NULL,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_code   VARCHAR(60);
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_name   VARCHAR(120);
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS scope_level VARCHAR(30);
        ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_role_code ON public.roles (role_code);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.permissions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            permission_code VARCHAR(100) NOT NULL,
            permission_name VARCHAR(150) NOT NULL,
            module_name     VARCHAR(80) NOT NULL,
            created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS permission_code VARCHAR(100);
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS permission_name VARCHAR(150);
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS module_name     VARCHAR(80);
        ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
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
        CREATE TABLE IF NOT EXISTS public.user_roles (
            user_id    UUID NOT NULL,
            role_id    UUID NOT NULL,
            tenant_id  VARCHAR(100) NOT NULL,
            company_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, role_id, tenant_id, company_id),
            CONSTRAINT fk_user_roles_role
                FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE
        );
        ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id  VARCHAR(100);
        ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id INTEGER;
        """,
        """
        CREATE TABLE IF NOT EXISTS public.user_company_access (
            user_id    UUID NOT NULL,
            tenant_id  VARCHAR(100) NOT NULL,
            company_id INTEGER NOT NULL,
            env_id     UUID,
            PRIMARY KEY (user_id, tenant_id, company_id)
        );
        ALTER TABLE public.user_company_access ADD COLUMN IF NOT EXISTS env_id UUID;
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
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS tenant_id        VARCHAR(100);
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS company_id       INTEGER;
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS env_code         VARCHAR(60);
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS env_name         VARCHAR(120);
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS api_base_url     VARCHAR(500);
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS middleware_route VARCHAR(500);
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS status           VARCHAR(20) NOT NULL DEFAULT 'active';
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP WITH TIME ZONE;
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
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS tenant_id      VARCHAR(100);
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS company_id     INTEGER;
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS env_id         UUID;
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS connector_type VARCHAR(50);
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS connector_name VARCHAR(150);
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS base_url       VARCHAR(500);
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS auth_type      VARCHAR(50);
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS secret_ref     VARCHAR(200);
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS status         VARCHAR(20) NOT NULL DEFAULT 'active';
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.connectors ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMP WITH TIME ZONE;
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
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS plan_code                 VARCHAR(60);
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS plan_name                 VARCHAR(150);
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS billing_cycle             VARCHAR(20) NOT NULL DEFAULT 'monthly';
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS query_limit               INTEGER;
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS concurrent_sessions_limit INTEGER;
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS overage_mode              VARCHAR(20) NOT NULL DEFAULT 'block';
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS active                    BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS created_at                TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.license_plans ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMP WITH TIME ZONE;
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
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS tenant_id                    VARCHAR(100);
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS plan_id                      UUID;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS contract_code                VARCHAR(80);
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS contract_status              VARCHAR(20) NOT NULL DEFAULT 'active';
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS starts_at                    DATE;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS ends_at                      DATE;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS query_limit_override         INTEGER;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS concurrent_sessions_override INTEGER;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS overage_mode_override        VARCHAR(20);
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS notes                        TEXT;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS created_at                   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.tenant_contracts ADD COLUMN IF NOT EXISTS updated_at                   TIMESTAMP WITH TIME ZONE;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_contracts_contract_code ON public.tenant_contracts (contract_code);
        CREATE INDEX IF NOT EXISTS idx_tenant_contracts_tenant_id ON public.tenant_contracts (tenant_id);
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                  FROM information_schema.table_constraints
                 WHERE table_schema = 'public'
                   AND table_name = 'tenant_contracts'
                   AND constraint_name = 'fk_tenant_contracts_plan'
            ) THEN
                ALTER TABLE public.tenant_contracts
                  ADD CONSTRAINT fk_tenant_contracts_plan
                  FOREIGN KEY (plan_id) REFERENCES public.license_plans(id);
            END IF;
        END $$;
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
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS tenant_id       VARCHAR(100);
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS contract_id     UUID;
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS period_ref      VARCHAR(20);
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS total_queries   INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS blocked_queries INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS overage_queries INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE public.query_usage_counters ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMP WITH TIME ZONE;
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
        ALTER TABLE public.concurrent_sessions ADD COLUMN IF NOT EXISTS tenant_id      VARCHAR(100);
        ALTER TABLE public.concurrent_sessions ADD COLUMN IF NOT EXISTS user_id        UUID;
        ALTER TABLE public.concurrent_sessions ADD COLUMN IF NOT EXISTS session_key    VARCHAR(120);
        ALTER TABLE public.concurrent_sessions ADD COLUMN IF NOT EXISTS started_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.concurrent_sessions ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMP WITH TIME ZONE;
        ALTER TABLE public.concurrent_sessions ADD COLUMN IF NOT EXISTS session_status VARCHAR(20) NOT NULL DEFAULT 'active';
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
        ALTER TABLE public.tenant_module_contracts ADD COLUMN IF NOT EXISTS tenant_id   VARCHAR(100);
        ALTER TABLE public.tenant_module_contracts ADD COLUMN IF NOT EXISTS contract_id UUID;
        ALTER TABLE public.tenant_module_contracts ADD COLUMN IF NOT EXISTS module_id   UUID;
        ALTER TABLE public.tenant_module_contracts ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'allowed';
        ALTER TABLE public.tenant_module_contracts ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_tenant_module_contracts_tenant_id ON public.tenant_module_contracts (tenant_id);
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                  FROM information_schema.table_constraints
                 WHERE table_schema = 'public'
                   AND table_name = 'tenant_module_contracts'
                   AND constraint_name = 'fk_tenant_module_contracts_module'
            ) THEN
                ALTER TABLE public.tenant_module_contracts
                  ADD CONSTRAINT fk_tenant_module_contracts_module
                  FOREIGN KEY (module_id) REFERENCES public.protheus_modules_master(id);
            END IF;
        END $$;
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
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id    VARCHAR(100);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id   INTEGER;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id      VARCHAR(100);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS module_name  VARCHAR(80);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action_name  VARCHAR(120);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_type  VARCHAR(80);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id    VARCHAR(120);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS request_id   VARCHAR(120);
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details_json JSONB;
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs (company_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.agent_users (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id     VARCHAR(100),
            email         VARCHAR(180),
            full_name     VARCHAR(180),
            password_hash VARCHAR(255),
            active        BOOLEAN NOT NULL DEFAULT TRUE,
            created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP WITH TIME ZONE
        );
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS tenant_id     VARCHAR(100);
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS email         VARCHAR(180);
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS full_name     VARCHAR(180);
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS active        BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE public.agent_users ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP WITH TIME ZONE;
        CREATE INDEX IF NOT EXISTS idx_agent_users_tenant_id ON public.agent_users (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.agent_roles (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   VARCHAR(100),
            role_code   VARCHAR(60),
            role_name   VARCHAR(120),
            scope_level VARCHAR(30),
            active      BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS tenant_id   VARCHAR(100);
        ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS role_code   VARCHAR(60);
        ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS role_name   VARCHAR(120);
        ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS scope_level VARCHAR(30);
        ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS active      BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE public.agent_roles ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_agent_roles_tenant_id ON public.agent_roles (tenant_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS public.agent_query_audit (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id               VARCHAR(100) NOT NULL,
            company_id              INTEGER,
            env_id                  UUID,
            user_id                 UUID,
            contract_id             UUID,
            snapshot_id             UUID,
            request_id              VARCHAR(120),
            natural_language_prompt TEXT,
            generated_sql           TEXT,
            sql_hash                VARCHAR(128),
            execution_status        VARCHAR(20) NOT NULL DEFAULT 'planned',
            rows_returned           INTEGER,
            response_time_ms        INTEGER,
            blocked_reason          VARCHAR(255),
            tables_used             TEXT,
            created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS tenant_id               VARCHAR(100);
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS company_id              INTEGER;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS env_id                  UUID;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS user_id                 UUID;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS contract_id             UUID;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS snapshot_id             UUID;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS request_id              VARCHAR(120);
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS natural_language_prompt TEXT;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS generated_sql           TEXT;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS sql_hash                VARCHAR(128);
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS execution_status        VARCHAR(20) NOT NULL DEFAULT 'planned';
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS rows_returned           INTEGER;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS response_time_ms        INTEGER;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS blocked_reason          VARCHAR(255);
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS tables_used             TEXT;
        ALTER TABLE public.agent_query_audit ADD COLUMN IF NOT EXISTS created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_agent_query_audit_tenant_id ON public.agent_query_audit (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_agent_query_audit_sql_hash ON public.agent_query_audit (sql_hash);
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
        ALTER TABLE public.platform_audit_log ADD COLUMN IF NOT EXISTS tenant_code VARCHAR(50);
        ALTER TABLE public.platform_audit_log ADD COLUMN IF NOT EXISTS actor       VARCHAR(150);
        ALTER TABLE public.platform_audit_log ADD COLUMN IF NOT EXISTS action      VARCHAR(100);
        ALTER TABLE public.platform_audit_log ADD COLUMN IF NOT EXISTS detail      JSONB;
        ALTER TABLE public.platform_audit_log ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP DEFAULT NOW();
        """,
        """
        DROP SCHEMA IF EXISTS "1" CASCADE;
        """
    ]

    try:
        _run_public_ddl(db, public_queries)
        _mark_public_bootstrap_done(db)
        _safe_commit(db)
        PUBLIC_BOOTSTRAP_DONE = True
    except Exception as e:
        _safe_rollback(db)
        PUBLIC_BOOTSTRAP_DONE = False
        print(f"[DB] Erro ao garantir tabelas globais em public: {e}")
