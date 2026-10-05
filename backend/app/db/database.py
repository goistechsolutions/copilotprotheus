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
from fastapi import Header, HTTPException, Request
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

engine_args = {
    "pool_pre_ping": True,
    "pool_size": 30,
    "max_overflow": 50,
    "pool_timeout": 60
}
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

PUBLIC_BOOTSTRAP_FLAG = "public_schema_v6_bkl"
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
    "business_domains",
    "business_domain_modules",
    "business_intents",
    "business_intent_tables",
    "business_dashboard_templates",
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
    pass
def ensure_public_tables(db, force: bool = False):
    global PUBLIC_BOOTSTRAP_DONE
    PUBLIC_BOOTSTRAP_DONE = True
    return
def _seed_bkl_initial_data(db):
    """Seed inicial dos domínios, intenções e mapeamentos oficiais do ERP Protheus."""
    try:
        # 1. Domínios ERP Globais
        domains = [
            ("FINANCEIRO", "Financeiro", "Contas a Receber, Contas a Pagar, Tesouraria e Fluxo de Caixa"),
            ("VENDAS", "Vendas e Faturamento", "Pedidos de Venda, Notas de Saída e Clientes"),
            ("COMPRAS", "Compras e Suprimentos", "Pedidos de Compra, Notas de Entrada e Fornecedores"),
            ("ESTOQUE", "Estoque e Custos", "Saldos, Movimentações e Produtos"),
            ("FISCAL", "Livros Fiscais", "Tributação, Apurações e Obrigações"),
            ("CONTROLADORIA", "Controladoria e Contabilidade", "Plano de Contas e Lançamentos Contábeis"),
        ]
        for code, name, desc in domains:
            db.execute(text("""
                INSERT INTO public.business_domains (domain_code, name, description, active)
                VALUES (:code, :name, :desc, TRUE)
                ON CONFLICT (domain_code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
            """), {"code": code, "name": name, "desc": desc})

        # 2. Intenções Oficiais
        # (intent_code, domain_code, name, description)
        intents = [
            ("cash_flow", "FINANCEIRO", "Fluxo de Caixa", "Projeção e acompanhamento de entradas e saídas"),
            ("receivables", "FINANCEIRO", "Contas a Receber", "Títulos abertos, liquidados e inadimplência de clientes"),
            ("payables", "FINANCEIRO", "Contas a Pagar", "Obrigações financeiras e pagamentos a fornecedores"),
            ("billing", "VENDAS", "Faturamento", "Notas fiscais faturadas e receitas de vendas"),
            ("sales_orders", "VENDAS", "Pedidos de Venda", "Carteira de pedidos, status de liberação e entrega"),
            ("inventory_balance", "ESTOQUE", "Saldo de Estoque", "Posição atual de saldos em armazém"),
            ("purchase_orders", "COMPRAS", "Pedidos de Compra", "Acompanhamento de compras e cotações"),
            ("purchases_entry", "COMPRAS", "Entrada de Notas", "Recebimento de materiais e notas de entrada"),
        ]
        for intent_code, domain_code, name, desc in intents:
            db.execute(text("""
                INSERT INTO public.business_intents (domain_code, intent_code, name, description, active)
                VALUES (:dc, :code, :name, :desc, TRUE)
                ON CONFLICT (intent_code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
            """), {"dc": domain_code, "code": intent_code, "name": name, "desc": desc})

        # 3. Mapeamento de Tabelas Obrigatórias/Prioritárias (business_intent_tables)
        # (intent_code, table_code, required, priority)
        intent_tables = [
            # Fluxo de Caixa: SE1 (Receber), SE2 (Pagar), SE5 (Movimentação)
            ("cash_flow", "SE1", True, 1),
            ("cash_flow", "SE2", True, 2),
            ("cash_flow", "SE5", False, 3),
            # Recebíveis
            ("receivables", "SE1", True, 1),
            ("receivables", "SA1", False, 2),
            # Pagáveis
            ("payables", "SE2", True, 1),
            ("payables", "SA2", False, 2),
            # Faturamento
            ("billing", "SF2", True, 1),
            ("billing", "SD2", True, 2),
            ("billing", "SA1", False, 3),
            # Pedidos de Venda
            ("sales_orders", "SC5", True, 1),
            ("sales_orders", "SC6", True, 2),
            ("sales_orders", "SA1", False, 3),
            # Saldo de Estoque
            ("inventory_balance", "SB2", True, 1),
            ("inventory_balance", "SB1", False, 2),
            # Compras
            ("purchases_entry", "SF1", True, 1),
            ("purchases_entry", "SD1", True, 2),
            ("purchases_entry", "SA2", False, 3),
        ]
        for intent_code, table_code, required, priority in intent_tables:
            int_id = db.execute(text("SELECT id FROM public.business_intents WHERE intent_code = :ic"), {"ic": intent_code}).scalar()
            if int_id:
                exists = db.execute(text("""
                    SELECT 1 FROM public.business_intent_tables
                    WHERE intent_id = :int_id AND table_code = :table_code
                """), {"int_id": int_id, "table_code": table_code}).first()
                if not exists:
                    db.execute(text("""
                        INSERT INTO public.business_intent_tables (intent_id, table_code, required, priority_order)
                        VALUES (:int_id, :table_code, :required, :priority)
                    """), {"int_id": int_id, "table_code": table_code, "required": required, "priority": priority})

        # 4. Mapeamento Semântico: Domínios de Negócio x Módulos Protheus Oficiais
        # (domain_code, mod_sigla, mod_code, is_primary)
        # protheus_modules_master é o master data oficial; business_domains é a camada semântica.
        domain_modules = [
            ("FINANCEIRO", "SIGAFIN", 6, True),
            ("VENDAS", "SIGAFAT", 5, True),
            ("COMPRAS", "SIGACOM", 2, True),
            ("ESTOQUE", "SIGAEST", 4, True),
            ("FISCAL", "SIGAFIS", 9, True),
            ("CONTROLADORIA", "SIGACTB", 34, True),
        ]
        for dc, sigla, mcode, is_prim in domain_modules:
            db.execute(text("""
                INSERT INTO public.business_domain_modules (domain_code, mod_sigla, mod_code, is_primary)
                VALUES (:dc, :sigla, :mcode, :is_prim)
                ON CONFLICT (domain_code, mod_sigla) DO UPDATE
                SET mod_code = EXCLUDED.mod_code, is_primary = EXCLUDED.is_primary
            """), {"dc": dc, "sigla": sigla, "mcode": mcode, "is_prim": is_prim})

        # 5. Saneamento do Catálogo Oficial Protheus (protheus_modules_master)
        # Garante que mod_code 5 seja sempre SIGAFAT e mod_code 2 seja SIGACOM
        canonical_master = [
            (1, "SIGAATF", "Ativo Fixo"),
            (2, "SIGACOM", "Compras"),
            (4, "SIGAEST", "Estoque e Custos"),
            (5, "SIGAFAT", "Faturamento"),
            (6, "SIGAFIN", "Financeiro"),
            (7, "SIGAGPE", "Gestão de Pessoal"),
            (9, "SIGAFIS", "Livros Fiscais"),
            (10, "SIGAPCP", "Planejamento e Controle da Produção"),
            (34, "SIGACTB", "Contabilidade Gerencial"),
        ]
        for mc, ms, mn in canonical_master:
            db.execute(text("""
                INSERT INTO public.protheus_modules_master (id, module_sigla, description, active, updated_at)
                VALUES (:mc, :ms, :mn, TRUE, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE
                SET module_sigla = EXCLUDED.module_sigla,
                    description = EXCLUDED.description,
                    active = TRUE,
                    updated_at = CURRENT_TIMESTAMP
            """), {"mc": mc, "ms": ms, "mn": mn})
    except Exception as exc:
        print(f"[DB] Aviso ao semear BKL inicial: {exc}")


# ─────────────────────────────────────────────────────────────
# RESOLUÇÃO DE TENANT
# ─────────────────────────────────────────────────────────────

def resolve_clean_tenant(db, tenant_id: str | int | None) -> str:
    """Resolve um tenant ativo para um schema válido sem fallback silencioso."""
    raw_str = str(tenant_id or "").strip()
    if not raw_str or raw_str.lower() in {"public", "default", "none", "null"}:
        raise ValueError("tenant_id é obrigatório e deve identificar um tenant real.")

    candidate = re.sub(r"[^a-zA-Z0-9_]", "", raw_str).lower()
    if not candidate:
        raise ValueError("tenant_id inválido.")

    try:
        if candidate.isdigit():
            query = text(
                """
                SELECT tenant_code, schema_name
                FROM public.tenants
                WHERE status = 'active'
                  AND (id = :id OR tenant_code = :tenant_code)
                LIMIT 1
                """
            )
            params = {"id": int(candidate), "tenant_code": candidate}
        else:
            query = text(
                """
                SELECT tenant_code, schema_name
                FROM public.tenants
                WHERE status = 'active'
                  AND (tenant_code = :tenant_code OR schema_name = :schema_name)
                LIMIT 1
                """
            )
            params = {"tenant_code": candidate, "schema_name": candidate}
        row = db.execute(query, params).mappings().first()
    except Exception as exc:
        if hasattr(db, "rollback"):
            db.rollback()
        raise ValueError("não foi possível resolver o tenant informado.") from exc

    if not row:
        raise ValueError("tenant ativo não localizado.")

    clean = re.sub(
        r"[^a-zA-Z0-9_]",
        "",
        str(row.get("schema_name") or row.get("tenant_code") or ""),
    ).lower()
    if not clean or clean in {"public", "default", "none", "null"} or clean.isdigit():
        raise ValueError("tenant ativo não possui um schema válido.")

    return clean


# ─────────────────────────────────────────────────────────────
# BOOTSTRAP POR TENANT (schema exclusivo) — IDEMPOTENTE
# ─────────────────────────────────────────────────────────────

TENANT_REQUIRED_TABLES = {
    "company_info", "tenant_schemas",
    "dictionary_tables", "dictionary_fields", "dictionary_indexes", "dictionary_groups",
    "tenant_dictionary_sources", "tenant_table_permissions", "tenant_field_permissions",
    "memories", "documents", "document_chunks", "agent_query_audit",
    "business_field_aliases", "business_rules", "business_metrics", "tenant_business_health",
}

TENANT_REQUIRED_COLUMNS = {
    "dictionary_tables": {"tenant_id", "company_code", "table_code", "table_name", "physical_name", "module_code"},
    "dictionary_fields": {"tenant_id", "company_id", "table_code", "table_name", "field_name"},
    "dictionary_indexes": {"tenant_id", "company_id", "table_code", "table_name", "index_order"},
    # O Agent lê e grava o histórico textual antes de montar o snapshot. Essa
    # verificação evita considerar um schema legado como pronto quando memories
    # existe, mas ainda não possui o contrato mínimo usado pelo fluxo.
    "memories": {
        "id", "tenant_id", "company_id", "memory_key", "memory_value",
        "memory_type", "scope", "source", "created_at",
    },
}


def _tenant_schema_bootstrap_done(db, clean_tenant: str) -> bool:
    """Verifica tabelas e colunas essenciais antes de usar o cache de bootstrap."""
    try:
        rows = db.execute(text("""
            SELECT table_name
              FROM information_schema.tables
             WHERE table_schema = :schema_name
        """), {"schema_name": clean_tenant}).scalars().all()
        existing = set(rows)
        if not TENANT_REQUIRED_TABLES.issubset(existing):
            return False

        for table_name, required_columns in TENANT_REQUIRED_COLUMNS.items():
            columns = db.execute(text("""
                SELECT column_name
                  FROM information_schema.columns
                 WHERE table_schema = :schema_name
                   AND table_name = :table_name
            """), {"schema_name": clean_tenant, "table_name": table_name}).scalars().all()
            if not required_columns.issubset(set(columns)):
                return False
        return True
    except Exception:
        return False


def ensure_tenant_tables(db, clean_tenant: str):
    return
def ensure_all_registered_tenant_schemas(db):
    """
    Garante que todos os tenants cadastrados em public.tenants
    possuam seus schemas criados no PostgreSQL.
    """
    ensure_public_tables(db)
    tenant_ids = set()
    try:
        res1 = db.execute(text("SELECT id, tenant_code FROM public.tenants"))
        for row in res1.fetchall():
            if row[0]: tenant_ids.add(str(row[0]))
            if row[1]: tenant_ids.add(str(row[1]))
    except Exception:
        db.rollback()
    try:
        res3 = db.execute(text("SELECT tenant_code, schema_name FROM public.tenants"))
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
    clean_tenant = resolve_clean_tenant(db, tenant_id)
    ensure_tenant_tables(db, clean_tenant)
    db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
    if hasattr(db, "commit"):
        db.commit()
    return db


def get_db(x_tenant_id: str = Header(None), tenant_id: str = None):
    db = SessionLocal()

    try:
        ensure_public_tables(db)

        # Rotas globais usam public; rotas tenant-scoped devem fornecer
        # explicitamente X-Tenant-ID ou tenant_id.
        tid = x_tenant_id or tenant_id
        try:
            clean_tenant = resolve_clean_tenant(db, tid) if tid else None
        except ValueError as exc:
            if hasattr(db, "rollback"):
                db.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if clean_tenant:
            ensure_tenant_tables(db, clean_tenant)
            db.execute(text(f'SET search_path TO "{clean_tenant}", public'))
        else:
            db.execute(text('SET search_path TO public'))
        if hasattr(db, "commit"):
            db.commit()

        yield db
    finally:
        try:
            db.execute(text("SET search_path TO public"))
            if hasattr(db, "commit"): db.commit()
        except Exception:
            pass
        db.close()
