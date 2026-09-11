"""
backend/app/models/business_knowledge.py

Copilot Protheus - Modelos SQLAlchemy da Business Knowledge Layer (BKL vNext)
Conforme especificação técnica oficial.
"""

from sqlalchemy import (
    Column, String, BigInteger, Boolean, Text, TIMESTAMP,
    ForeignKey, Integer
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.database import GlobalBase, TenantBase


# ═══════════════════════════════════════════════════════════════
# CAMADA GLOBAL — schema `public` (GlobalBase)
# ═══════════════════════════════════════════════════════════════

class BusinessDomain(GlobalBase):
    """Catálogo global dos domínios ERP (Financeiro, Vendas, Compras, etc.)."""
    __tablename__ = "business_domains"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    domain_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessDomainModule(GlobalBase):
    """Mapeamento explícito entre Domínios de Negócio e Módulos Oficiais do Protheus."""
    __tablename__ = "business_domain_modules"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    domain_code = Column(String(50), ForeignKey("public.business_domains.domain_code", ondelete="CASCADE"), nullable=False, index=True)
    mod_sigla = Column(String(30), nullable=False, index=True)
    mod_code = Column(Integer, nullable=False, index=True)
    is_primary = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessIntent(GlobalBase):
    """Representa as intenções de negócio compreendidas pelo agente."""
    __tablename__ = "business_intents"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    domain_id = Column(BigInteger, ForeignKey("public.business_domains.id", ondelete="CASCADE"), nullable=False, index=True)
    intent_code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessIntentTable(GlobalBase):
    """Relaciona intenções às tabelas necessárias (SE1, SE2, SF2, etc.)."""
    __tablename__ = "business_intent_tables"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    intent_id = Column(BigInteger, ForeignKey("public.business_intents.id", ondelete="CASCADE"), nullable=False, index=True)
    table_code = Column(String(20), nullable=False, index=True)
    required = Column(Boolean, default=True, nullable=False)
    priority_order = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessDashboardTemplate(GlobalBase):
    """Define dashboards e layouts oficiais por intenção."""
    __tablename__ = "business_dashboard_templates"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    intent_id = Column(BigInteger, ForeignKey("public.business_intents.id", ondelete="CASCADE"), nullable=False, index=True)
    dashboard_code = Column(String(100), unique=True, nullable=False, index=True)
    layout_json = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════════════════
# CAMADA TENANT — schema do tenant (TenantBase)
# ═══════════════════════════════════════════════════════════════

class BusinessFieldAlias(TenantBase):
    """Tradução semântica dos campos para termos de negócio executivos."""
    __tablename__ = "business_field_aliases"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    field_name = Column(String(120), nullable=False, index=True)
    business_name = Column(String(200), nullable=False)
    field_format = Column(String(50))
    field_description = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessRule(TenantBase):
    """Regras de negócio específicas configuradas para o tenant."""
    __tablename__ = "business_rules"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    intent_code = Column(String(100), nullable=False, index=True)
    rule_type = Column(String(100), nullable=False)
    rule_json = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessMetric(TenantBase):
    """Catálogo de KPIs e métricas governadas."""
    __tablename__ = "business_metrics"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    metric_code = Column(String(100), nullable=False, index=True)
    metric_name = Column(String(200), nullable=False)
    metric_formula = Column(Text, nullable=False)
    metric_type = Column(String(50), default="currency")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class TenantBusinessHealth(TenantBase):
    """Tabela crítica de auditoria de integridade do conhecimento por intenção."""
    __tablename__ = "tenant_business_health"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    intent_code = Column(String(100), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    validation_json = Column(JSONB, nullable=False)
    validated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
