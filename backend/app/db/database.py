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

DATABASE_URL = os.getenv('DATABASE_URL', '')

try:
    ensure_database_exists(DATABASE_URL)
except Exception:
    pass

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
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
        "CREATE TABLE IF NOT EXISTS public.tenant_registry (id SERIAL PRIMARY KEY, tenant_code VARCHAR(50) UNIQUE NOT NULL, tenant_name VARCHAR(150) NOT NULL, schema_name VARCHAR(63) UNIQUE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', plan_code VARCHAR(50), created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), provisioned_at TIMESTAMP, decommissioned_at TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS public.plans (plan_code VARCHAR(50) PRIMARY KEY, plan_name VARCHAR(150) NOT NULL, max_users INTEGER DEFAULT 5, max_queries_day INTEGER DEFAULT 500, modules_allowed JSONB DEFAULT '[]', active BOOLEAN DEFAULT TRUE);",
        "CREATE TABLE IF NOT EXISTS public.platform_admins (id SERIAL PRIMARY KEY, email VARCHAR(150) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, is_superadmin BOOLEAN DEFAULT FALSE, active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW());",
        "CREATE TABLE IF NOT EXISTS public.platform_audit_log (id BIGSERIAL PRIMARY KEY, tenant_code VARCHAR(50), actor VARCHAR(150), action VARCHAR(100) NOT NULL, detail JSONB, created_at TIMESTAMP DEFAULT NOW());",
        "CREATE TABLE IF NOT EXISTS public.tenants (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), tenant_code VARCHAR(100), tenant_name VARCHAR(255), protheus_rest_url VARCHAR(1024), protheus_user VARCHAR(255), encrypted_protheus_password TEXT, auth_mode VARCHAR(50) DEFAULT 'basic', system_prompt TEXT, temperature FLOAT DEFAULT 0.2, status VARCHAR(50) DEFAULT 'active', plan_code VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.companies (id SERIAL PRIMARY KEY, tenant_id VARCHAR(100), cnpj VARCHAR(30), ie VARCHAR(30), razao_social VARCHAR(255), email VARCHAR(255), telefone VARCHAR(50), endereco VARCHAR(500), protheus_grupo VARCHAR(20), protheus_empresa VARCHAR(20), protheus_unidade VARCHAR(20), protheus_filial VARCHAR(30), protheus_ambientes VARCHAR(100) DEFAULT 'producao', protheus_usuario VARCHAR(100), encrypted_protheus_password TEXT, protheus_rest_url VARCHAR(1024), protheus_webapp_url VARCHAR(1024), licenca_uso TEXT, status VARCHAR(50) DEFAULT 'ativa', company_code VARCHAR(60), company_name VARCHAR(200), protheus_env VARCHAR(100), protheus_branch VARCHAR(100), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100), email VARCHAR(180) NOT NULL UNIQUE, full_name VARCHAR(180) NOT NULL, password_hash VARCHAR(255) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role_code VARCHAR(60) NOT NULL UNIQUE, role_name VARCHAR(120) NOT NULL, scope_level VARCHAR(30) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS public.permissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), permission_code VARCHAR(100) NOT NULL UNIQUE, permission_name VARCHAR(150) NOT NULL, module_name VARCHAR(80) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS public.environments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, company_id INT, env_code VARCHAR(60) NOT NULL, env_name VARCHAR(120) NOT NULL, api_base_url VARCHAR(500), middleware_route VARCHAR(500), status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.connectors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, company_id INT, env_id UUID, connector_type VARCHAR(50) NOT NULL, connector_name VARCHAR(150) NOT NULL, base_url VARCHAR(500), auth_type VARCHAR(50), secret_ref VARCHAR(200), status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.license_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plan_code VARCHAR(60) NOT NULL UNIQUE, plan_name VARCHAR(150) NOT NULL, billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', query_limit INT, concurrent_sessions_limit INT, overage_mode VARCHAR(20) NOT NULL DEFAULT 'block', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.tenant_contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, plan_id UUID, contract_code VARCHAR(80) NOT NULL UNIQUE, contract_status VARCHAR(20) NOT NULL DEFAULT 'active', starts_at DATE NOT NULL, ends_at DATE, query_limit_override INT, concurrent_sessions_override INT, overage_mode_override VARCHAR(20), notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.query_usage_counters (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, contract_id UUID NOT NULL, period_ref VARCHAR(20) NOT NULL, total_queries INT NOT NULL DEFAULT 0, blocked_queries INT NOT NULL DEFAULT 0, overage_queries INT NOT NULL DEFAULT 0, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.concurrent_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, user_id UUID, session_key VARCHAR(120) NOT NULL UNIQUE, started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP WITH TIME ZONE, session_status VARCHAR(20) NOT NULL DEFAULT 'active');",
        "CREATE TABLE IF NOT EXISTS public.protheus_modules_master (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_code VARCHAR(30) NOT NULL UNIQUE, module_name VARCHAR(150) NOT NULL, source_name VARCHAR(60) NOT NULL DEFAULT 'SYS_USR_MODULE', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE);",
        "CREATE TABLE IF NOT EXISTS public.tenant_module_contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100) NOT NULL, contract_id UUID NOT NULL, module_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'allowed', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS public.audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(100), company_id INT, user_id VARCHAR(100), module_name VARCHAR(80) NOT NULL, action_name VARCHAR(120) NOT NULL, target_type VARCHAR(80), target_id VARCHAR(120), request_id VARCHAR(120), details_json JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);"
    ]

    for q in public_queries:
        try:
            db.execute(text(q))
            if hasattr(db, "commit"): db.commit()
        except Exception as q_err:
            try:
                if hasattr(db, "rollback"): db.rollback()
            except: pass

def ensure_tenant_tables(db, clean_tenant: str):
    ensure_public_tables(db)
    if not clean_tenant or clean_tenant == "public":
        return
    try:
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{clean_tenant}"'))
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))

        # 1. protheus_modules
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".protheus_modules (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) NOT NULL,
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

        # 5. dictionary_snapshots, tenant_dictionary_tables, fields, indexes, allowed tables & fields
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".dictionary_snapshots (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(100) NOT NULL,
                company_id INT,
                env_id UUID,
                snapshot_code VARCHAR(80) NOT NULL,
                source_db_type VARCHAR(30) NOT NULL DEFAULT 'oracle',
                source_label VARCHAR(150),
                sync_mode VARCHAR(20) NOT NULL DEFAULT 'full',
                sync_status VARCHAR(20) NOT NULL DEFAULT 'completed',
                requested_by UUID,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP WITH TIME ZONE,
                total_modules INT DEFAULT 0,
                total_tables INT DEFAULT 0,
                total_fields INT DEFAULT 0,
                total_indexes INT DEFAULT 0,
                notes TEXT
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_dictionary_tables (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                snapshot_id UUID NOT NULL,
                tenant_id VARCHAR(100) NOT NULL,
                company_id INT,
                env_id UUID,
                module_code VARCHAR(30),
                table_key VARCHAR(20) NOT NULL,
                physical_name VARCHAR(30) NOT NULL,
                table_name VARCHAR(255),
                unique_index_expr TEXT,
                x2_tamfil NUMERIC(10,2),
                x2_modo VARCHAR(5),
                x2_tamun NUMERIC(10,2),
                x2_modoun VARCHAR(5),
                x2_tamemp NUMERIC(10,2),
                x2_modoemp VARCHAR(5),
                usa_empresa VARCHAR(1) NOT NULL DEFAULT 'N',
                usa_unidade VARCHAR(1) NOT NULL DEFAULT 'N',
                usa_filial VARCHAR(1) NOT NULL DEFAULT 'N',
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_dictionary_fields (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                snapshot_id UUID NOT NULL,
                tenant_id VARCHAR(100) NOT NULL,
                table_id UUID NOT NULL,
                field_name VARCHAR(40) NOT NULL,
                field_description VARCHAR(255),
                field_type VARCHAR(5),
                field_length NUMERIC(10,2),
                field_order INT,
                sxg_group VARCHAR(20),
                sxg_size NUMERIC(10,2),
                is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
                mask_rule VARCHAR(50),
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_dictionary_indexes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                snapshot_id UUID NOT NULL,
                tenant_id VARCHAR(100) NOT NULL,
                table_id UUID NOT NULL,
                index_order INT,
                index_nickname VARCHAR(80),
                index_expression TEXT NOT NULL,
                is_unique BOOLEAN NOT NULL DEFAULT FALSE,
                is_primary_hint BOOLEAN NOT NULL DEFAULT FALSE,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_allowed_tables (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(100) NOT NULL,
                contract_id UUID NOT NULL,
                snapshot_id UUID NOT NULL,
                table_id UUID NOT NULL,
                access_level VARCHAR(20) NOT NULL DEFAULT 'query',
                allowed BOOLEAN NOT NULL DEFAULT TRUE,
                rationale VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "{clean_tenant}".tenant_allowed_fields (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id VARCHAR(100) NOT NULL,
                allowed_table_id UUID NOT NULL,
                field_id UUID NOT NULL,
                allowed BOOLEAN NOT NULL DEFAULT TRUE,
                masking_required BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

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

        # Migração transparente de dados legados do public se existirem
        try:
            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".protheus_modules (tenant_id, usr_modulo, usr_codmod, created_at)
                SELECT tenant_id, usr_modulo, usr_codmod, created_at
                FROM public.protheus_modules
                WHERE tenant_id = '{clean_tenant}'
                ON CONFLICT DO NOTHING;
            """))
            db.execute(text(f"""
                INSERT INTO "{clean_tenant}".tenant_schemas (tenant_id, modulo, chave, tabela, nome, schema_json, created_at, updated_at)
                SELECT tenant_id, modulo, chave, tabela, nome, schema_json, created_at, updated_at
                FROM public.tenant_schemas
                WHERE tenant_id = '{clean_tenant}'
                ON CONFLICT DO NOTHING;
            """))
        except Exception:
            pass

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[DB] Erro ao garantir tabelas no schema '{clean_tenant}': {e}")

def get_tenant_session(tenant_id: str):
    db = SessionLocal()
    ensure_public_tables(db)
    clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id or 'default'))
    if not clean_tenant:
        clean_tenant = "default"
    if clean_tenant != "public":
        try:
            db.execute(text("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public"))
            db.commit()
        except Exception:
            db.rollback()
        ensure_tenant_tables(db, clean_tenant)
    db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
    db.commit()
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
                db.commit()
            except Exception:
                db.rollback()
                
            ensure_tenant_tables(db, clean_tenant)
            
        db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        db.commit()
        
        yield db
    finally:
        try:
            db.execute(text("SET search_path TO public"))
            db.commit()
        except Exception:
            pass
        db.close()
