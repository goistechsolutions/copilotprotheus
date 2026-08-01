"""seed módulos Protheus

Revision ID: 0002_seed_protheus_modules
Revises: 0001_init_public_schema
Create Date: 2026-08-01

Insere o catálogo completo de módulos Protheus com suas tabelas principais
conforme documentação TOTVS (SE1, SE2, SB1, SA1, etc.).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002_seed_protheus_modules"
down_revision = "0001_init_public_schema"
branch_labels = None
depends_on = None

# Catálogo de módulos Protheus conforme dicionário TOTVS
# Fonte: Tabelas-de-referencia.pdf
MODULES = [
    {
        "module_code": "SIGAFAT",
        "module_name": "Faturamento",
        "description": "Pedidos de venda, notas fiscais de saída, TES e faturamento.",
        "main_tables": ["SF1", "SF2", "SD1", "SD2", "SC5", "SC6", "SF4", "SA1"],
    },
    {
        "module_code": "SIGAEST",
        "module_name": "Controle de Estoque",
        "description": "Saldos, movimentos de estoque, produtos e lotes.",
        "main_tables": ["SB1", "SB2", "SB9", "SD3", "SB5", "SBF"],
    },
    {
        "module_code": "SIGAFIN",
        "module_name": "Financeiro",
        "description": "Contas a receber, contas a pagar e movimento bancário.",
        "main_tables": ["SE1", "SE2", "SE5", "SA6", "SEA"],
    },
    {
        "module_code": "SIGAFIS",
        "module_name": "Livros Fiscais",
        "description": "Apuração fiscal, livros de entrada e saída, SPED.",
        "main_tables": ["SF1", "SF2", "SFT", "SFC", "SFB"],
    },
    {
        "module_code": "SIGACOM",
        "module_name": "Compras",
        "description": "Pedidos de compra, cotações, notas fiscais de entrada.",
        "main_tables": ["SC7", "SC1", "SC9", "SF1", "SD1", "SA2"],
    },
    {
        "module_code": "SIGAGPE",
        "module_name": "Gestão de Pessoal",
        "description": "Folha de pagamento, funcionários, verbas e afastamentos.",
        "main_tables": ["SRA", "SRB", "SRC", "SRD", "SRE", "SRV", "RD0"],
    },
    {
        "module_code": "SIGACTB",
        "module_name": "Contabilidade Gerencial",
        "description": "Plano de contas, lançamentos contábeis e relatórios gerenciais.",
        "main_tables": ["CT1", "CT2", "CT5", "CTD"],
    },
    {
        "module_code": "SIGAPCP",
        "module_name": "PCP - Planejamento e Controle da Produção",
        "description": "Ordens de produção, estrutura de produto e roteiros.",
        "main_tables": ["SC2", "SC3", "SG1", "SG2", "SG3"],
    },
    {
        "module_code": "SIGACRM",
        "module_name": "CRM",
        "description": "Gestão de clientes, oportunidades e campanhas de marketing.",
        "main_tables": ["SA1", "AGB", "AGC", "AGD"],
    },
    {
        "module_code": "SIGAMNT",
        "module_name": "Manutenção de Ativos",
        "description": "Ordens de manutenção, planos preventivos e ativos.",
        "main_tables": ["ST8", "ST9", "STA", "STB"],
    },
]

# Planos iniciais da plataforma
PLANS = [
    {
        "plan_code": "FREE",
        "plan_name": "Gratuito",
        "max_users": 1,
        "max_queries_day": 50,
        "modules_allowed": ["SIGAFAT", "SIGAEST"],
        "price_brl": 0.0,
        "is_active": True,
    },
    {
        "plan_code": "STARTER",
        "plan_name": "Starter",
        "max_users": 5,
        "max_queries_day": 500,
        "modules_allowed": ["SIGAFAT", "SIGAEST", "SIGAFIN", "SIGACOM"],
        "price_brl": 297.0,
        "is_active": True,
    },
    {
        "plan_code": "PROFESSIONAL",
        "plan_name": "Professional",
        "max_users": 20,
        "max_queries_day": 2000,
        "modules_allowed": [
            "SIGAFAT", "SIGAEST", "SIGAFIN", "SIGAFIS",
            "SIGACOM", "SIGAGPE", "SIGACTB", "SIGAPCP",
        ],
        "price_brl": 897.0,
        "is_active": True,
    },
    {
        "plan_code": "ENTERPRISE",
        "plan_name": "Enterprise",
        "max_users": 9999,
        "max_queries_day": 99999,
        "modules_allowed": [
            "SIGAFAT", "SIGAEST", "SIGAFIN", "SIGAFIS",
            "SIGACOM", "SIGAGPE", "SIGACTB", "SIGAPCP",
            "SIGACRM", "SIGAMNT",
        ],
        "price_brl": 0.0,  # Sob consulta
        "is_active": True,
    },
]


def upgrade() -> None:
    now = datetime.now(timezone.utc)
    conn = op.get_bind()

    # Seed: plans
    plans_table = sa.table(
        "plans",
        sa.column("plan_code", sa.String),
        sa.column("plan_name", sa.String),
        sa.column("max_users", sa.Integer),
        sa.column("max_queries_day", sa.Integer),
        sa.column("modules_allowed", sa.JSON),
        sa.column("price_brl", sa.Float),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        schema="public",
    )
    conn.execute(
        plans_table.insert(),
        [{**p, "created_at": now} for p in PLANS],
    )

    # Seed: protheus_modules_master
    modules_table = sa.table(
        "protheus_modules_master",
        sa.column("id", sa.String),
        sa.column("module_code", sa.String),
        sa.column("module_name", sa.String),
        sa.column("description", sa.String),
        sa.column("main_tables", sa.JSON),
        sa.column("created_at", sa.DateTime(timezone=True)),
        schema="public",
    )
    conn.execute(
        modules_table.insert(),
        [{**m, "id": str(uuid.uuid4()), "created_at": now} for m in MODULES],
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM public.protheus_modules_master WHERE module_code = ANY(:codes)")
        .bindparams(codes=[m["module_code"] for m in MODULES])
    )
    conn.execute(
        sa.text("DELETE FROM public.plans WHERE plan_code = ANY(:codes)")
        .bindparams(codes=[p["plan_code"] for p in PLANS])
    )
