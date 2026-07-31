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
            res = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :dbname"), {"dbname": target_db}).scalar()
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

def ensure_public_tables(db):
    try:
        db.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        if hasattr(db, "commit"): db.commit()
    except Exception:
        try:
            if hasattr(db, "rollback"): db.rollback()
        except: pass

    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public"))
        if hasattr(db, "commit"): db.commit()
    except Exception:
        try:
            if hasattr(db, "rollback"): db.rollback()
        except: pass

    public_queries = [
        "CREATE TABLE IF NOT EXISTS public.tenant_registry (id SERIAL PRIMARY KEY, tenant_code VARCHAR(50) UNIQUE NOT NULL CHECK (tenant_code ~ '^[a-z0-9_]+$'), tenant_name VARCHAR(150) NOT NULL, schema_name VARCHAR(63) UNIQUE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','active','suspended','decommissioned')), plan_code VARCHAR(50), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), provisioned_at TIMESTAMP, decommissioned_at TIMESTAMP);",
        "ALTER TABLE public.tenant_registry ALTER COLUMN updated_at DROP NOT NULL;",
        "CREATE TABLE IF NOT EXISTS public.plans (plan_code VARCHAR(50) PRIMARY KEY, plan_name VARCHAR(150) NOT NULL, max_users INTEGER DEFAULT 5, max_queries_day INTEGER DEFAULT 500, modules_allowed JSONB DEFAULT '[]', active BOOLEAN DEFAULT TRUE);",
        "CREATE TABLE IF NOT EXISTS public.platform_admins (id SERIAL PRIMARY KEY, email VARCHAR(150) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, is_superadmin BOOLEAN DEFAULT FALSE, active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW());",
        "CREATE TABLE IF NOT EXISTS public.protheus_modules_master (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), mod_code VARCHAR(30) UNIQUE, module_code VARCHAR(30) UNIQUE, mod_name VARCHAR(150), module_name VARCHAR(150), description TEXT, source_name VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.platform_audit_log (id BIGSERIAL PRIMARY KEY, tenant_code VARCHAR(50), actor VARCHAR(150), action VARCHAR(100) NOT NULL, detail JSONB, created_at TIMESTAMP DEFAULT NOW());",
        'DROP SCHEMA IF EXISTS "1" CASCADE;'
    ]

    try:
        db.execute(text("DROP TABLE IF EXISTS public.tenants, public.companies, public.agent_query_audit, public.users, public.roles, public.permissions, public.environments, public.connectors, public.license_plans, public.tenant_contracts, public.query_usage_counters, public.concurrent_sessions, public.tenant_module_contracts, public.audit_logs, public.agent_users, public.agent_roles, public.company_modules, public.api_usage_logs, public.tenant_dictionary_sources, public.dictionary_tables, public.dictionary_fields, public.dictionary_indexes, public.dictionary_groups, public.tenant_table_permissions, public.tenant_field_permissions, public.tenant_allowed_tables, public.tenant_allowed_fields, public.tenant_dictionary_tables, public.tenant_dictionary_fields, public.tenant_dictionary_indexes, public.dictionary_snapshots CASCADE"))
        if hasattr(db, "commit"): db.commit()
    except Exception:
        if hasattr(db, "rollback"): db.rollback()

    for q in public_queries:
        try:
            db.execute(text(q))
            if hasattr(db, "commit"): db.commit()
        except Exception as q_err:
            try:
                if hasattr(db, "rollback"): db.rollback()
            except: pass

def resolve_clean_tenant(db, tenant_id: str | int | None) -> str:
    """
    Garante que o tenant_id seja convertido em um nome de schema válido.
    Se for numérico (ex: '1' ou 1), busca no tenant_registry ou assume o primeiro tenant ou 'default'.
    NUNCA retorna um nome de schema puramente numérico ou 'public'.
    """
    raw_str = str(tenant_id or '').strip()
    if not raw_str or raw_str == "public":
        return "default"

    clean = re.sub(r'[^a-zA-Z0-9_]', '', raw_str)

    if clean.isdigit():
        try:
            reg = db.execute(
                text("SELECT tenant_code, schema_name FROM public.tenant_registry WHERE id = :id OR tenant_code = :tc LIMIT 1"),
                {"id": int(clean), "tc": clean}
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

    clean = re.sub(r'[^a-zA-Z0-9_]', '', str(clean))
    if not clean or clean == "public" or clean.isdigit():
        clean = "default"

    return clean


def ensure_tenant_tables(db, clean_tenant: str):
    ensure_public_tables(db)
    clean_tenant = resolve_clean_tenant(db, clean_tenant)

    try:
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

        # 1. company_info
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".company_info (
                id                      SERIAL PRIMARY KEY,
                tenant_id               VARCHAR(100),
                company_code            VARCHAR(60) NOT NULL,
                branch_code             VARCHAR(60) NOT NULL,
                company_name            VARCHAR(200) NOT NULL,
                cnpj                    VARCHAR(30),
                ie                      VARCHAR(30),
                razao_social            VARCHAR(255),
                email                   VARCHAR(255),
                telefone                VARCHAR(50),
                endereco                VARCHAR(500),
                protheus_grupo          VARCHAR(20),
                protheus_empresa        VARCHAR(20),
                protheus_unidade        VARCHAR(20),
                protheus_filial         VARCHAR(30),
                environment             VARCHAR(60) DEFAULT 'producao',
                protheus_ambientes      VARCHAR(100) DEFAULT 'producao',
                webapp_url              TEXT,
                protheus_rest_url       TEXT,
                protheus_usuario        VARCHAR(100),
                encrypted_protheus_password TEXT,
                auth_mode               VARCHAR(30) DEFAULT 'basic',
                status                  VARCHAR(20) DEFAULT 'active',
                system_prompt           TEXT,
                temperature             NUMERIC(3,2) DEFAULT 0.20,
                created_at              TIMESTAMP DEFAULT NOW(),
                updated_at              TIMESTAMP DEFAULT NOW(),
                UNIQUE (company_code, branch_code)
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".protheus_modules (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_code VARCHAR(60),
                usr_modulo VARCHAR(50) NOT NULL,
                usr_codmod VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_tenant ON "{clean_tenant}".protheus_modules (tenant_id);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_codmod ON "{clean_tenant}".protheus_modules (usr_codmod);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_pm_modulo ON "{clean_tenant}".protheus_modules (usr_modulo);
        """))

        # 2. tenant_schemas
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_schemas (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                modulo VARCHAR(50),
                chave VARCHAR(10) NOT NULL,
                tabela VARCHAR(50),
                nome VARCHAR(255),
                schema_json JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_tenant ON "{clean_tenant}".tenant_schemas (tenant_id);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_modulo ON "{clean_tenant}".tenant_schemas (modulo);
            CREATE INDEX IF NOT EXISTS idx_{clean_tenant}_ts_chave ON "{clean_tenant}".tenant_schemas (chave);
        """))

        # 3. dictionary_tables & fields & indexes & groups
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_tables (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code VARCHAR(60) NOT NULL,
                table_name VARCHAR(30) NOT NULL,
                table_alias VARCHAR(80),
                module_code VARCHAR(10),
                description TEXT,
                physical_name VARCHAR(80),
                active_flag BOOLEAN NOT NULL DEFAULT TRUE,
                raw_payload JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_fields (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code VARCHAR(60) NOT NULL,
                table_name VARCHAR(30) NOT NULL,
                field_name VARCHAR(30) NOT NULL,
                title VARCHAR(120),
                field_type VARCHAR(5),
                length_num INT,
                decimal_num INT,
                required_flag BOOLEAN NOT NULL DEFAULT FALSE,
                browse_flag BOOLEAN NOT NULL DEFAULT FALSE,
                virtual_flag BOOLEAN NOT NULL DEFAULT FALSE,
                validation_rule TEXT,
                relation_rule TEXT,
                when_rule TEXT,
                raw_payload JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_indexes (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code VARCHAR(60) NOT NULL,
                table_name VARCHAR(30) NOT NULL,
                index_order VARCHAR(10) NOT NULL,
                nickname VARCHAR(80),
                expression TEXT,
                raw_payload JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_groups (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                snapshot_code VARCHAR(60) NOT NULL,
                group_name VARCHAR(80) NOT NULL,
                description TEXT,
                raw_payload JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # 4. tenant_dictionary_sources & permissions
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_dictionary_sources (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                source_type VARCHAR(20) NOT NULL,
                snapshot_code VARCHAR(60) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP WITH TIME ZONE,
                finished_at TIMESTAMP WITH TIME ZONE,
                error_message TEXT
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_table_permissions (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                role_id VARCHAR(100) NOT NULL,
                table_name VARCHAR(30) NOT NULL,
                can_list BOOLEAN NOT NULL DEFAULT FALSE,
                can_describe BOOLEAN NOT NULL DEFAULT FALSE,
                can_query BOOLEAN NOT NULL DEFAULT FALSE,
                approved_by VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_field_permissions (
                id BIGSERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
                company_id VARCHAR(100),
                environment_id VARCHAR(100) NOT NULL DEFAULT 'producao',
                role_id VARCHAR(100) NOT NULL,
                table_name VARCHAR(30) NOT NULL,
                field_name VARCHAR(30) NOT NULL,
                can_select BOOLEAN NOT NULL DEFAULT FALSE,
                can_filter BOOLEAN NOT NULL DEFAULT FALSE,
                masked_flag BOOLEAN NOT NULL DEFAULT FALSE,
                approved_by VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # 5. Limpeza de todas as tabelas operacionais legadas e duplicadas no schema do tenant
        try:
            db.execute(text(f'DROP TABLE IF EXISTS "{clean_tenant}".tenant_dictionary_tables, "{clean_tenant}".tenant_dictionary_fields, "{clean_tenant}".tenant_dictionary_indexes, "{clean_tenant}".dictionary_snapshots, "{clean_tenant}".tenant_allowed_tables, "{clean_tenant}".tenant_allowed_fields CASCADE'))
            if hasattr(db, "commit"): db.commit()
        except Exception:
            pass

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
                document_id INT NOT NULL,
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
        """))

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[DB] Erro ao garantir tabelas no schema '{clean_tenant}': {e}")

def ensure_all_registered_tenant_schemas(db):
    """
    Garante que todos os tenants e empresas cadastrados em public.tenants,
    public.companies e public.tenant_registry possuam seus schemas criados no PostgreSQL.
    """
    ensure_public_tables(db)
    tenant_ids = set()
    try:
        res1 = db.execute(text("SELECT id, tenant_code FROM public.tenants"))
        for row in res1.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
            if row[1]: tenant_ids.add(str(row[1]))
    except Exception:
        pass
    try:
        res2 = db.execute(text("SELECT tenant_id FROM public.companies WHERE tenant_id IS NOT NULL"))
        for row in res2.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
    except Exception:
        pass
    try:
        res3 = db.execute(text("SELECT tenant_code, schema_name FROM public.tenant_registry"))
        for row in res3.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
            if row[1]: tenant_ids.add(str(row[1]).replace("tenant_", ""))
    except Exception:
        pass

    for tid in tenant_ids:
        clean = re.sub(r'[^a-zA-Z0-9_]', '', str(tid))
        if clean and clean != "public":
            try:
                ensure_tenant_tables(db, clean)
            except Exception as err:
                print(f"[DB] Aviso ao provisionar schema '{clean}': {err}")

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
