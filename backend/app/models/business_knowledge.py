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

    domain_code = Column(String(50), primary_key=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessDomainModule(GlobalBase):
    __tablename__ = "business_domain_modules"
    __table_args__ = {"schema": "public", "extend_existing": True}

    domain_code = Column(String(64), ForeignKey("public.business_domains.domain_code", ondelete="CASCADE"), primary_key=True, nullable=False, index=True)
    module_id = Column(Integer, ForeignKey("public.protheus_modules_master.id"), primary_key=True, nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

class BusinessIntent(GlobalBase):
    """Representa as intenções de negócio compreendidas pelo agente."""
    __tablename__ = "business_intents"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_code = Column(String(50), ForeignKey("public.business_domains.domain_code", ondelete="CASCADE"), nullable=False, index=True)
    intent_code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessIntentTable(GlobalBase):
    """Relaciona intenções às tabelas necessárias (SE1, SE2, SF2, etc.)."""
    __tablename__ = "business_intent_tables"
    __table_args__ = {"schema": "public", "extend_existing": True}

    intent_id = Column(UUID(as_uuid=True), ForeignKey("public.business_intents.id", ondelete="CASCADE"), primary_key=True, nullable=False, index=True)
    table_code = Column(String(20), primary_key=True, nullable=False, index=True)
    required = Column(Boolean, default=True, nullable=False)
    priority_order = Column(Integer, default=1)


class BusinessDashboardTemplate(GlobalBase):
    """Define dashboards e layouts oficiais por intenção."""
    __tablename__ = "business_dashboard_templates"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    intent_id = Column(UUID(as_uuid=True), ForeignKey("public.business_intents.id", ondelete="CASCADE"), nullable=False, index=True)
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
    synonyms = Column(String(500))
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


# ═══════════════════════════════════════════════════════════════
# MODELOS NORMALIZADOS DE REGRAS DO TENANT (V2 / SCHEMA DINÂMICO)
# ═══════════════════════════════════════════════════════════════

class BusinessRuleSet(TenantBase):
    """Agrupador e versionamento de conjuntos de regras do tenant."""
    __tablename__ = "business_rule_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_set_code = Column(String(100), unique=True, nullable=False)
    name = Column(String(160), nullable=False)
    status = Column(String(24), nullable=False, default="ACTIVE")
    version = Column(Integer, nullable=False, default=1)
    valid_from = Column(TIMESTAMP(timezone=True))
    valid_to = Column(TIMESTAMP(timezone=True))
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessRuleTes(TenantBase):
    """Classificação e efeitos de TES (SF4) por conjunto de regras."""
    __tablename__ = "business_rule_tes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_set_id = Column(UUID(as_uuid=True), nullable=False)
    tes_code = Column(String(16), nullable=False)
    direction = Column(String(16), nullable=False)
    classification_code = Column(String(64), nullable=False)
    affects_gross_revenue = Column(Boolean, default=False, nullable=False)
    affects_net_revenue = Column(Boolean, default=False, nullable=False)
    affects_abc = Column(Boolean, default=False, nullable=False)
    revenue_effect = Column(String(16), default="IGNORE", nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessCfopRule(TenantBase):
    """Classificação fiscal de CFOPs por conjunto de regras."""
    __tablename__ = "business_cfop_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_set_id = Column(UUID(as_uuid=True), nullable=False)
    cfop_code = Column(String(16), nullable=False)
    classification_code = Column(String(64), nullable=False)
    operation_type = Column(String(32))
    affects_revenue = Column(Boolean, default=False, nullable=False)
    affects_inventory = Column(Boolean, default=False, nullable=False)
    affects_tax = Column(Boolean, default=False, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessFinancialNature(TenantBase):
    """Classificação de naturezas financeiras (SED) por conjunto de regras."""
    __tablename__ = "business_financial_natures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_set_id = Column(UUID(as_uuid=True), nullable=False)
    nature_code = Column(String(64), nullable=False)
    nature_name = Column(String(200))
    financial_group = Column(String(64), nullable=False)
    cashflow_type = Column(String(32))
    affects_result = Column(Boolean, default=True, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessRevenueConfig(TenantBase):
    """Configurações da composição de faturamento do tenant."""
    __tablename__ = "business_revenue_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True))
    included_classifications = Column(JSONB, default=list, nullable=False)
    excluded_classifications = Column(JSONB, default=list, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessReceivableConfig(TenantBase):
    """Políticas de contas a receber e inadimplência."""
    __tablename__ = "business_receivable_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True))
    overdue_days = Column(Integer, default=30, nullable=False)
    include_renegotiated = Column(Boolean, default=False, nullable=False)
    include_provisional = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessInventoryConfig(TenantBase):
    """Parâmetros temporais para alertas de estoque."""
    __tablename__ = "business_inventory_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True))
    stock_idle_days = Column(Integer, default=90)
    stock_critical_days = Column(Integer, default=7)
    stock_rupture_days = Column(Integer, default=0)
    version = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessAbcConfig(TenantBase):
    """Distribuição percentual da Curva ABC."""
    __tablename__ = "business_abc_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True))
    class_a_pct = Column(JSONB)
    class_b_pct = Column(JSONB)
    class_c_pct = Column(JSONB)
    version = Column(Integer, default=1, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class BusinessSynonym(TenantBase):
    """Dicionário de sinônimos de negócio para prompts da IA."""
    __tablename__ = "business_synonyms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_term = Column(String(100), nullable=False)
    target_term = Column(String(100), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

