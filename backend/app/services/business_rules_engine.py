"""
backend/app/services/business_rules_engine.py

Motor de Regras de Negócio por Tenant (Business Rules Center):
- Aplica substituição dinâmica de sinônimos antes de processar perguntas.
- Carrega classificações de TES (Venda, Bonificação, Devolução, etc.), CFOP e Naturezas.
- Injeta regras customizadas de cada empresa no SQL Generator.
- Registra eventos de auditoria (business_rule_audit).
"""

import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("app.business_rules_engine")

class BusinessRulesEngine:
    @staticmethod
    def apply_synonyms(prompt: str, tenant_id: str, db: Session) -> str:
        """Substitui termos do prompt pelos termos-alvo configurados em business_synonyms."""
        clean_prompt = (prompt or "").strip()
        if not clean_prompt or not tenant_id:
            return clean_prompt

        try:
            rows = db.execute(text("""
                SELECT source_term, target_term
                FROM public.business_synonyms
                WHERE tenant_id = :tenant_id
            """), {"tenant_id": str(tenant_id).lower()}).fetchall()

            for source, target in rows:
                if source and target:
                    # Substituição segura de palavras inteiras (case-insensitive)
                    pattern = re.compile(rf"\b{re.escape(source.strip())}\b", re.IGNORECASE)
                    clean_prompt = pattern.sub(target.strip(), clean_prompt)
        except Exception as exc:
            logger.warning("Erro ao aplicar sinônimos para tenant %s: %s", tenant_id, exc)

        return clean_prompt

    @staticmethod
    def get_tenant_rules(tenant_id: str, db: Session) -> Dict[str, Any]:
        """Carrega todas as regras de negócio ativas para o tenant."""
        rules = {
            "tes_sales": [],
            "tes_bonus": [],
            "tes_devolution": [],
            "tes_all": [],
            "cfop_rules": [],
            "financial_natures": [],
            "module_config": {},
        }
        if not tenant_id:
            return rules

        tid = str(tenant_id).lower()
        try:
            # 1. TES
            tes_rows = db.execute(text("""
                SELECT tes, direction, classification, description, active
                FROM public.business_rule_tes
                WHERE tenant_id = :tid AND active = TRUE
            """), {"tid": tid}).mappings().all()

            for r in tes_rows:
                tes_code = str(r["tes"]).strip()
                classification = str(r["classification"] or "").lower()
                rules["tes_all"].append(dict(r))
                if "venda" in classification:
                    rules["tes_sales"].append(tes_code)
                elif "bonifica" in classification:
                    rules["tes_bonus"].append(tes_code)
                elif "devolu" in classification:
                    rules["tes_devolution"].append(tes_code)

            # 2. CFOP
            cfop_rows = db.execute(text("""
                SELECT cfop, classification
                FROM public.business_cfop_rules
                WHERE tenant_id = :tid
            """), {"tid": tid}).mappings().all()
            rules["cfop_rules"] = [dict(r) for r in cfop_rows]

            # 3. Naturezas Financeiras
            nat_rows = db.execute(text("""
                SELECT nature_code, nature_name, financial_group
                FROM public.business_financial_natures
                WHERE tenant_id = :tid
            """), {"tid": tid}).mappings().all()
            rules["financial_natures"] = [dict(r) for r in nat_rows]

            # 4. Parâmetros / Configurações do Módulo
            cfg = db.execute(text("""
                SELECT billing_included_classifications, billing_excluded_classifications,
                       receivables_overdue_days, receivables_include_renegotiated, receivables_include_provisional,
                       stock_idle_days, stock_critical_days, stock_rupture_days,
                       abc_curve_a_pct, abc_curve_b_pct, abc_curve_c_pct, ai_cash_flow_tables
                FROM public.business_module_configs
                WHERE tenant_id = :tid
            """), {"tid": tid}).mappings().first()
            if cfg:
                rules["module_config"] = dict(cfg)

        except Exception as exc:
            logger.warning("Erro ao carregar regras de negócio do tenant %s: %s", tenant_id, exc)

        return rules

    @staticmethod
    def build_rules_instruction(tenant_rules: Dict[str, Any], prompt: str, domain: Optional[str]) -> str:
        """Gera a cláusula textual de regras do tenant para injeção no prompt do LLM."""
        instructions = []
        prompt_lower = (prompt or "").lower()

        # 1. Regras de TES para Faturamento e Vendas
        tes_sales = tenant_rules.get("tes_sales", [])
        tes_bonus = tenant_rules.get("tes_bonus", [])
        tes_dev = tenant_rules.get("tes_devolution", [])

        if "bonifica" in prompt_lower:
            if tes_bonus:
                formatted = ", ".join(f"'{c}'" for c in tes_bonus)
                instructions.append(f"Para Bonificações, utilize EXCLUSIVAMENTE o filtro: D2_TES IN ({formatted}).")
        elif domain == "sales" or any(w in prompt_lower for w in ["fatur", "venda", "receita"]):
            if tes_sales:
                formatted = ", ".join(f"'{c}'" for c in tes_sales)
                instructions.append(f"Para Faturamento e Vendas deste tenant, filtre OBRIGATORIAMENTE as TES de venda: D2_TES IN ({formatted}).")
            if tes_bonus:
                formatted_bonus = ", ".join(f"'{c}'" for c in tes_bonus)
                instructions.append(f"NUNCA inclua as TES de bonificação deste tenant: D2_TES NOT IN ({formatted_bonus}).")

        # 2. Regras de Recebíveis / Inadimplência
        cfg = tenant_rules.get("module_config", {})
        if domain == "finance" or any(w in prompt_lower for w in ["receber", "inadimpl", "atraso", "vencid"]):
            overdue_days = cfg.get("receivables_overdue_days")
            if overdue_days is not None:
                instructions.append(f"A inadimplência deste tenant é considerada após {overdue_days} dias de atraso.")
            if cfg.get("receivables_include_renegotiated") is False:
                instructions.append("NÃO considerar títulos renegociados.")
            if cfg.get("receivables_include_provisional") is True:
                instructions.append("Considerar títulos provisórios no cálculo financeiro.")

        # 3. Regras de Estoque
        if domain == "stock" or any(w in prompt_lower for w in ["estoque", "parado", "sem giro", "ruptura"]):
            idle_days = cfg.get("stock_idle_days")
            if idle_days:
                instructions.append(f"Produtos são considerados parados/sem giro após {idle_days} dias sem movimentação.")
            crit_days = cfg.get("stock_critical_days")
            if crit_days:
                instructions.append(f"Estoque é considerado crítico com cobertura abaixo de {crit_days} dias.")

        if not instructions:
            return ""

        joined = " ".join(instructions)
        return f"\n=== REGRAS DE NEGÓCIO DO TENANT (BUSINESS RULES CENTER) ===\n{joined}\n===========================================================\n"

    @staticmethod
    def audit_change(
        db: Session,
        tenant_id: str,
        user_id: str,
        rule_entity: str,
        action: str,
        previous_value: Any = None,
        new_value: Any = None,
    ):
        """Registra a alteração na tabela de auditoria."""
        try:
            audit_id = uuid.uuid4().hex
            prev_json = json.dumps(previous_value) if previous_value is not None else None
            new_json = json.dumps(new_value) if new_value is not None else None

            db.execute(text("""
                INSERT INTO public.business_rule_audit
                    (id, tenant_id, user_id, event_date, rule_entity, action, previous_value, new_value)
                VALUES
                    (:id, :tenant_id, :user_id, NOW(), :rule_entity, :action, :previous_value, :new_value)
            """), {
                "id": audit_id,
                "tenant_id": str(tenant_id).lower(),
                "user_id": str(user_id),
                "rule_entity": rule_entity,
                "action": action,
                "previous_value": prev_json,
                "new_value": new_json,
            })
            db.commit()
        except Exception as exc:
            logger.warning("Falha ao registrar auditoria de regra de negócio: %s", exc)
