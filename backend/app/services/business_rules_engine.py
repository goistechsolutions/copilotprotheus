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

from app.db.database import resolve_clean_tenant

class BusinessRulesEngine:
    @staticmethod
    def apply_synonyms(prompt: str, tenant_id: str, db: Session) -> str:
        """Substitui termos do prompt pelos termos-alvo configurados em business_synonyms."""
        clean_prompt = (prompt or "").strip()
        if not clean_prompt or not tenant_id:
            return clean_prompt

        try:
            try:
                clean_tenant = resolve_clean_tenant(db, tenant_id)
            except Exception:
                clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id)).lower()

            rows = db.execute(text(f"""
                SELECT source_term, target_term
                FROM "{clean_tenant}".business_synonyms
                WHERE active = TRUE
            """), {}).fetchall()

            for source, target in rows:
                if source and target:
                    pattern = re.compile(rf"\b{re.escape(source.strip())}\b", re.IGNORECASE)
                    clean_prompt = pattern.sub(target.strip(), clean_prompt)
        except Exception as exc:
            logger.warning("Erro ao aplicar sinônimos para tenant %s: %s", tenant_id, exc)

        return clean_prompt

    @staticmethod
    def get_tenant_rules(tenant_id: str, db: Session) -> Dict[str, Any]:
        """Carrega todas as regras de negócio ativas para o schema do tenant (V2)."""
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

        try:
            try:
                clean_tenant = resolve_clean_tenant(db, tenant_id)
            except Exception:
                clean_tenant = re.sub(r'[^a-zA-Z0-9_]', '', str(tenant_id)).lower()

            # 1. TES
            try:
                tes_rows = db.execute(text(f"""
                    SELECT tes_code AS tes, direction, classification_code AS classification,
                           affects_gross_revenue, affects_net_revenue, affects_abc, revenue_effect, active
                    FROM "{clean_tenant}".business_rule_tes
                    WHERE active = TRUE
                """)).mappings().all()

                for r in tes_rows:
                    tes_code = str(r["tes"]).strip()
                    classification = str(r["classification"] or "").lower()
                    rules["tes_all"].append(dict(r))
                    if "venda" in classification or "exporta" in classification:
                        rules["tes_sales"].append(tes_code)
                    elif "bonifica" in classification:
                        rules["tes_bonus"].append(tes_code)
                    elif "devolu" in classification:
                        rules["tes_devolution"].append(tes_code)
            except Exception as tes_err:
                logger.debug("Aviso ao ler business_rule_tes de %s: %s", clean_tenant, tes_err)

            # 2. CFOP
            try:
                cfop_rows = db.execute(text(f"""
                    SELECT cfop_code AS cfop, classification_code AS classification,
                           affects_revenue, affects_inventory, affects_tax
                    FROM "{clean_tenant}".business_cfop_rules
                    WHERE active = TRUE
                """)).mappings().all()
                rules["cfop_rules"] = [dict(r) for r in cfop_rows]
            except Exception as cfop_err:
                logger.debug("Aviso ao ler business_cfop_rules de %s: %s", clean_tenant, cfop_err)

            # 3. Naturezas Financeiras
            try:
                nat_rows = db.execute(text(f"""
                    SELECT nature_code, nature_name, financial_group
                    FROM "{clean_tenant}".business_financial_natures
                    WHERE active = TRUE
                """)).mappings().all()
                rules["financial_natures"] = [dict(r) for r in nat_rows]
            except Exception as nat_err:
                logger.debug("Aviso ao ler business_financial_natures de %s: %s", clean_tenant, nat_err)

            # 4. Parâmetros / Configurações do Módulo
            try:
                rev = db.execute(text(f'SELECT included_classifications, excluded_classifications FROM "{clean_tenant}".business_revenue_configs WHERE active = TRUE ORDER BY version DESC LIMIT 1')).mappings().first()
                rec = db.execute(text(f'SELECT overdue_days, include_renegotiated, include_provisional FROM "{clean_tenant}".business_receivable_configs WHERE active = TRUE ORDER BY version DESC LIMIT 1')).mappings().first()
                inv = db.execute(text(f'SELECT stock_idle_days, stock_critical_days, stock_rupture_days FROM "{clean_tenant}".business_inventory_configs WHERE active = TRUE ORDER BY version DESC LIMIT 1')).mappings().first()
                abc = db.execute(text(f'SELECT class_a_pct, class_b_pct, class_c_pct FROM "{clean_tenant}".business_abc_configs WHERE active = TRUE ORDER BY version DESC LIMIT 1')).mappings().first()

                cfg_dict = {
                    "billing_included_classifications": rev["included_classifications"] if rev else ["VENDA", "EXPORTACAO"],
                    "billing_excluded_classifications": rev["excluded_classifications"] if rev else ["BONIFICACAO", "REMESSA", "TRANSFERENCIA"],
                    "receivables_overdue_days": rec["overdue_days"] if rec else 30,
                    "receivables_include_renegotiated": rec["include_renegotiated"] if rec else False,
                    "receivables_include_provisional": rec["include_provisional"] if rec else True,
                    "stock_idle_days": inv["stock_idle_days"] if inv else 90,
                    "stock_critical_days": inv["stock_critical_days"] if inv else 7,
                    "stock_rupture_days": inv["stock_rupture_days"] if inv else 0,
                    "abc_curve_a_pct": float(abc["class_a_pct"]) if abc else 80.0,
                    "abc_curve_b_pct": float(abc["class_b_pct"]) if abc else 15.0,
                    "abc_curve_c_pct": float(abc["class_c_pct"]) if abc else 5.0,
                    "ai_cash_flow_tables": ["SE1", "SE2", "SE5"],
                }
                rules["module_config"] = cfg_dict
            except Exception as cfg_err:
                logger.debug("Aviso ao ler configs do tenant %s: %s", clean_tenant, cfg_err)

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
                instructions.append(
                    f"Para Faturamento e Vendas deste tenant: se houver JOIN com a tabela de itens SD2, filtre as TES de venda: D2_TES IN ({formatted}). "
                    f"IMPORTANTE: Se a consulta for feita apenas na tabela de cabeçalho SF2 (SF2010), NUNCA use F2_TES (F2_TES NÃO EXISTE NO PROTHEUS); filtre notas normais usando EXCLUSIVAMENTE SF2.F2_TIPO = 'N'."
                )
            if tes_bonus:
                formatted_bonus = ", ".join(f"'{c}'" for c in tes_bonus)
                instructions.append(f"Se houver itens (SD2), NUNCA inclua as TES de bonificação: D2_TES NOT IN ({formatted_bonus}).")

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
        trace_id: Optional[str] = None
    ):
        """Registra a alteração na tabela de auditoria com trace de requisição."""
        try:
            # Garante que a coluna trace_id existe (evolução de schema)
            db.execute(text("ALTER TABLE public.business_rule_audit ADD COLUMN IF NOT EXISTS trace_id VARCHAR(50);"))
            
            audit_id = uuid.uuid4().hex
            prev_json = json.dumps(previous_value) if previous_value is not None else None
            new_json = json.dumps(new_value) if new_value is not None else None

            db.execute(text("""
                INSERT INTO public.business_rule_audit
                    (id, tenant_id, user_id, event_date, rule_entity, action, previous_value, new_value, trace_id)
                VALUES
                    (:id, :tenant_id, :user_id, NOW(), :rule_entity, :action, :previous_value, :new_value, :trace_id)
            """), {
                "id": audit_id,
                "tenant_id": str(tenant_id).lower(),
                "user_id": str(user_id),
                "rule_entity": rule_entity,
                "action": action,
                "previous_value": prev_json,
                "new_value": new_json,
                "trace_id": trace_id,
            })
            db.commit()
        except Exception as exc:
            logger.warning("Falha ao registrar auditoria de regra de negócio: %s", exc)
