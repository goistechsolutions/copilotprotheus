import base64
import os
import json
import re
import unicodedata
import logging
from typing import Dict, Any, List
from app.services.tenant_resolver import resolve_clean_tenant
from app.services.business import (
    infer_query_domain as _infer_query_domain,
    get_domain_instruction as _get_domain_instruction,
    get_allowed_families,
    get_blocked_families,
    extract_dimensions_and_measures,
    generate_insights
)
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, Field
import uuid
import asyncio
import time
import math

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.db.database import get_db, SessionLocal
from app.core.config import settings
from app.core.logging_config import get_correlation_id
from app.core.auth import get_current_user

from app.services.dictionary_context_service import (
    build_dictionary_context,
    render_context_for_prompt,
)
from app.services.protheus_context_service import (
    CatalogValidationError,
    build_protheus_context,
    mask_sensitive_rows,
    validate_query_security,
)
from app.services.protheus_service import ProtheusServiceError, get_tenant_config
from app.services.queryrest_service import queryrest_exec_tenant
from app.services.entitlement_guard import EntitlementDenied, EntitlementGuard
from app.services.protheus_module_catalog import quote_tenant_schema
from app.core.auth import get_current_user, require_current_user

logger = logging.getLogger("app.api.agent_sql")
router = APIRouter(prefix="/agent", tags=["agent-sql"], dependencies=[Depends(require_current_user)])


def _normalized_agent_error(
    *,
    message: Any,
    status_code: int | None,
    correlation_id: str,
    default_source: str = "api",
) -> dict[str, Any]:
    """Converte falhas internas em um contrato público estável e sanitizado."""
    text_message = " ".join(str(message or "Falha não especificada.").split())[:500]
    status = status_code if status_code and 400 <= status_code <= 599 else None
    normalized = text_message.lower()
    if default_source == "protheus_queryrest" or any(
        marker in normalized for marker in ("queryrest", "appserver", "protheus")
    ):
        source = "protheus_queryrest"
        code = "PROTHEUS_QUERYREST_ERROR"
    elif default_source == "gemini" or any(
        marker in normalized for marker in ("gemini", "generativelanguage", "provedor de ia")
    ):
        source = "gemini"
        code = "GEMINI_UNAVAILABLE" if status in {429, 500, 502, 503, 504} else "GEMINI_ERROR"
    elif status in {401, 403}:
        source = "api"
        code = "API_AUTHORIZATION_ERROR"
    else:
        source = default_source
        code = "AGENT_ERROR"
    retryable = status in {408, 429, 500, 502, 503, 504}
    return {
        "error_source": source,
        "http_status": status,
        "error_code": code,
        "message": text_message,
        "correlation_id": correlation_id,
        "retryable": retryable,
    }


def _normalized_http_exception(exc: HTTPException, correlation_id: str, default_source: str = "api") -> dict[str, Any]:
    return _normalized_agent_error(
        message=exc.detail,
        status_code=exc.status_code,
        correlation_id=correlation_id,
        default_source=default_source,
    )


def _is_non_metric_field(field_name: str) -> bool:
    name = str(field_name or "").strip().upper()
    return bool(re.search(
        r"(^|_)(MES|MÊS|ANO|YEAR|PERIODO|PERÍODO|DATA|DATE|COD|CODIGO|CÓDIGO|ID|NUMERO|NÚMERO|NR|FILIAL|EMPRESA|BRANCH)(_|$)",
        name,
    )) or name.startswith(("MES_", "MÊS_", "ANO_", "DATA_", "COD_", "CODIGO_"))


def _parse_summary_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value) if math.isfinite(float(value)) else None
    if not isinstance(value, str) or not value.strip():
        return None
    candidate = value.strip().replace("R$", "").replace("%", "").replace(" ", "")
    if not re.fullmatch(r"[+-]?[0-9][0-9.,]*", candidate):
        return None
    if "," in candidate and "." in candidate:
        candidate = candidate.replace(".", "").replace(",", ".")
    elif "," in candidate:
        candidate = candidate.replace(",", ".")
    try:
        parsed = float(candidate)
        return parsed if math.isfinite(parsed) else None
    except ValueError:
        return None



def _build_semantic_result(rows: list[dict[str, Any]]) -> dict:
    columns = list(rows[0].keys()) if rows and isinstance(rows[0], dict) else []
    dimensions = []
    measures = []
    
    # Identify dimensions and measures
    for col in columns:
        name = str(col).upper()
        if re.search(r"(^|_)(ANO|MES|DATA|DATE|PERIODO|COD|CODIGO|ID|NUMERO|NR|FILIAL|EMPRESA|BRANCH|VENDEDOR|VEND|PRODUTO|ITEM|GRUPO)(_|$)", name):
            # It's a dimension
            kind = "time" if re.search(r"ANO|MES|DATA|DATE|PERIODO", name) else "string"
            dimensions.append({
                "key": col,
                "label": col,
                "kind": kind
            })
        else:
            # Check if it's a measure
            values = [_parse_summary_number(row.get(col)) for row in rows if isinstance(row, dict)]
            numeric_values = [v for v in values if v is not None]
            if numeric_values and re.search(r"VALOR|ORIGINAL|TOTAL|FATUR|RECEITA|SALDO|PRE[ÇC]O|MARGEM|QUANT|QTD|VOLUME", name):
                measures.append({
                    "key": col,
                    "label": col,
                    "format": "currency" if re.search(r"VALOR|ORIGINAL|FATUR|RECEITA|SALDO|PRE[ÇC]O", name) else "number",
                    "aggregation": "sum"
                })

    # Build KPIs
    kpis = []
    series = []
    
    if measures:
        primary_measure = measures[0]
        # Calculate KPI value
        total_val = sum((_parse_summary_number(row.get(primary_measure["key"])) or 0) for row in rows)
        
        kpi = {
            "key": f"total_{primary_measure['key'].lower()}",
            "label": primary_measure["label"],
            "value": total_val,
            "format": primary_measure["format"],
            "source_column": primary_measure["key"],
            "aggregation": primary_measure["aggregation"]
        }
        
        time_dim = next((d for d in dimensions if d["kind"] == "time"), None)
        if time_dim:
            kpi["dimension"] = time_dim["key"]
            
            # Build series
            points = []
            for row in rows:
                lbl = str(row.get(time_dim["key"], ""))
                val = _parse_summary_number(row.get(primary_measure["key"])) or 0
                points.append({"label": lbl, "value": val})
                
            series.append({
                "id": f"series_{primary_measure['key'].lower()}",
                "label": primary_measure["label"],
                "dimension": time_dim["key"],
                "measure": primary_measure["key"],
                "format": primary_measure["format"],
                "points": points
            })
            
        kpis.append(kpi)
        
        # Build Real Insights based on actual data
        fmt_total = f"R$ {total_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if primary_measure["format"] == "currency" else f"{total_val:,.2f}"
        fmt_avg = f"R$ {(total_val / len(rows) if rows else 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if primary_measure["format"] == "currency" else f"{(total_val / len(rows) if rows else 0):,.2f}"
        
        insights = [
            {
                "title": "Análise de Volume",
                "description": f"A consulta encontrou {len(rows)} registros na base do Protheus.",
                "value": f"{len(rows)} documentos",
                "type": "info"
            },
            {
                "title": "Consolidação Numérica",
                "description": f"O total agregado nas colunas de métrica foi de {fmt_total}. O valor médio por registro é de {fmt_avg}.",
                "value": fmt_total,
                "type": "opportunity" if total_val > 0 else "info"
            },
            {
                "title": "Validação de Tendência",
                "description": "Não foram identificadas comparações históricas suficientes nas colunas retornadas para prever tendências.",
                "value": "Análise Restrita",
                "type": "info"
            }
        ]
        
    return {
        "columns": columns,
        "insights": insights if measures else [],
        "rows": rows,
        "metadata": {
            "row_count": len(rows),
            "source": "queryrest"
        },
        "dimensions": dimensions,
        "measures": measures,
        "kpis": kpis,
        "series": series
    }

def _build_safe_result_summary(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "Consulta concluída sem registros para o contexto e filtros informados."
    columns = list(rows[0].keys()) if isinstance(rows[0], dict) else []
    candidates = []
    for column in columns:
        values = [_parse_summary_number(row.get(column)) for row in rows if isinstance(row, dict)]
        numeric_values = [value for value in values if value is not None]
        if not numeric_values or _is_non_metric_field(column):
            continue
        name = str(column).upper()
        semantic = bool(re.search(r"VALOR|ORIGINAL|TOTAL|FATUR|RECEITA|SALDO|PRE[ÇC]O|MARGEM|QUANT|QTD|VOLUME", name))
        candidates.append((1 if semantic else 0, column, numeric_values))
    candidates.sort(key=lambda item: (item[0], len(item[2])), reverse=True)
    if not candidates:
        return f"A consulta retornou {len(rows)} registros. Não foi identificada uma métrica numérica financeira segura; consulte a tabela detalhada para analisar os campos autorizados."
    _, metric, values = candidates[0]
    total = sum(values)
    average = total / len(values)

    # Detecção de fluxo de caixa (RECEBIMENTO / PAGAMENTO)
    cash_types = {"RECEBIMENTO", "PAGAMENTO", "RECEBER", "PAGAR", "A RECEBER", "A PAGAR"}
    type_col = None
    for col in columns:
        sample = {str(r.get(col, "")).upper().strip() for r in rows[:50] if isinstance(r, dict)}
        if sample & cash_types:
            type_col = col
            break

    if type_col:
        total_receber = 0.0
        total_pagar = 0.0
        for r in rows:
            if not isinstance(r, dict):
                continue
            tipo = str(r.get(type_col, "")).upper().strip()
            val = abs(_parse_summary_number(r.get(metric)) or 0.0)
            if tipo in {"RECEBIMENTO", "RECEBER", "A RECEBER", "RECEITA", "ENTRADA", "CR", "C"}:
                total_receber += val
            elif tipo in {"PAGAMENTO", "PAGAR", "A PAGAR", "DESPESA", "SAIDA", "DR", "D"}:
                total_pagar += val

        # Se houver TANTO recebimentos QUANTO pagamentos, é Fluxo de Caixa
        if total_receber > 0 and total_pagar > 0:
            saldo = total_receber - total_pagar
            status_saldo = "Superávit projetado" if saldo >= 0 else "Déficit projetado"
            fmt_rec = f"R$ {total_receber:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            fmt_pag = f"R$ {total_pagar:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            fmt_sal = f"R$ {saldo:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return (
                f"**Resumo do Fluxo de Caixa (Próximos Dias):**\n\n"
                f"• **Total em Aberto a Receber:** {fmt_rec}\n"
                f"• **Total em Aberto a Pagar:** {fmt_pag}\n"
                f"• **Saldo Projetado (Diferença):** {fmt_sal} ({status_saldo})\n"
                f"• **Títulos em Aberto:** {len(rows)} registros analisados."
            )
        elif total_receber > 0 and total_pagar == 0:
            fmt_rec = f"R$ {total_receber:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            avg_rec = f"R$ {(total_receber / len(rows)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return (
                f"**Resumo de Títulos a Receber em Aberto:**\n\n"
                f"• **Total em Aberto a Receber:** {fmt_rec}\n"
                f"• **Média por Título:** {avg_rec}\n"
                f"• **Quantidade de Títulos:** {len(rows)} títulos analisados."
            )
        elif total_pagar > 0 and total_receber == 0:
            fmt_pag = f"R$ {total_pagar:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            avg_pag = f"R$ {(total_pagar / len(rows)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return (
                f"**Resumo de Títulos a Pagar em Aberto:**\n\n"
                f"• **Total em Aberto a Pagar:** {fmt_pag}\n"
                f"• **Média por Título:** {avg_pag}\n"
                f"• **Quantidade de Títulos:** {len(rows)} títulos analisados."
            )


    dimensions = [
        column for column in columns
        if re.search(r"VENDEDOR|VEND|SUBGRUPO|PRODUTO|CLIENTE|MES|MÊS|PERIODO|PERÍODO", str(column).upper())
        and not _is_non_metric_field(column) or re.search(r"MES|MÊS|SUBGRUPO", str(column).upper())
    ]
    dimension_text = f" Dimensões presentes: {', '.join(dict.fromkeys(str(item) for item in dimensions))}." if dimensions else ""
    return (
        f"A consulta ao Protheus retornou {len(rows)} registros. "
        f"Considerando somente o campo numérico autorizado {metric}, o total dos registros retornados é R$ {total:,.2f} "
        f"e a média por registro é R$ {average:,.2f}.{dimension_text}"
    )


# Gerenciador em memória para polling de tarefas do agente
AGENT_TASKS = {}


async def real_llm_sql_generator(
    prompt: str, 
    context_text: str, 
    empresa: str, 
    filial: str, 
    xfilial: str,
    tenant_id: str,
    environment_code: str,
    image: str = None,
    history: list[dict[str, str]] | None = None,
    domain: str | None = None,
) -> str:
    """
    Aciona o provedor Gemini configurado no backend (Gemini 2.5 Flash)
    para gerar instruções SQL puras adequadas ao banco de dados Oracle do Protheus na TOTVS Cloud,
    respeitando as regras e exclusões lógicas sem inventar estruturas não permitidas.
    """
    system_instruction = f"""Você é o Copilot Protheus SQL Generator, especialista sênior no dicionário de dados do ERP TOTVS Protheus para banco de dados ORACLE em Cloud (SaaS/Hetzner/Cloudflare).
Sua tarefa exclusiva é transformar a pergunta analítica ou de negócio do usuário em UMA ÚNICA consulta SELECT na sintaxe ORACLE perfeitamente formatada para execução via endpoint /QueryRest.

=== CONTEXTO DO DICIONÁRIO DE DADOS AUTORIZADO (RBAC / MÓDULOS CONTRATADOS) ===
Você SÓ pode consultar e referenciar as tabelas e campos listados explicitamente no snapshot abaixo:
{context_text}
=============================================================================

    DIRETRIZES GERAIS E INNEGOCIÁVEIS:
1. Retorne EXCLUSIVAMENTE uma única instrução SELECT ou WITH Oracle. Não envolva a resposta em markdown, comentários ou texto introdutório.
2. Use somente tabelas, nomes físicos e campos presentes no snapshot autorizado. Nunca derive nome físico com sufixo, nunca invente tabela/campo e nunca use `X3_RELACAO` para criar JOIN.
3. Banco ORACLE: nunca use `SELECT TOP` ou `LIMIT`. Se precisar limitar resultados, use a sintaxe Oracle (`ROWNUM <= N` ou `FETCH FIRST N ROWS ONLY`). Não limite o número de registros arbitrariamente (ex: não use `FETCH FIRST 500 ROWS ONLY`), a menos que o usuário solicite expressamente. Limites artificiais corrompem a totalização de KPIs e valores financeiros no Dashboard.
4. Use aliases claros e selecione somente os campos necessários. Nunca use `SELECT *`.
5. Toda tabela Protheus do FROM/JOIN deve possuir seu próprio filtro `alias.D_E_L_E_T_ <> '*'`.
6. Respeite as flags SHARING/SX2 de cada tabela. Inclua empresa, unidade e/ou filial somente quando o snapshot indicar que o nível é usado; a filial operacional autorizada é '{xfilial}'. Nunca deduza XFILIAL.
7. Priorize os índices SIX e o `UNIQUE_INDEX` informados para montar JOINs e filtros. Se o relacionamento não estiver sustentado por SIX, X2_UNICO ou convenção Protheus documentada, não invente o JOIN.
8. Padrões documentados: SF2/SD2 usam F2_FILIAL=D2_FILIAL, F2_DOC=D2_DOC e F2_SERIE=D2_SERIE; SF1/SD1 usam filial, documento, série, fornecedor e loja; TES usa D2_TES/F4_CODIGO ou D1_TES/F4_CODIGO quando essas tabelas estiverem autorizadas.
9. Filtros de negócio usuais, como F2_TIPO='N' ou F4_DUPLIC='S', só podem ser usados quando o campo estiver no snapshot e forem pertinentes ao pedido.
10. Nunca acessar campos marcados como sigilosos/mascarados e nunca retornar senha, token, JWT, secret, certificado ou chave.
11. Contexto operacional: empresa='{empresa}', filial='{filial}', XFILIAL='{xfilial}'. Se o snapshot não sustentar a regra necessária, informe a impossibilidade em vez de fabricar SQL.
12. Fidelidade: gere SQL somente com evidências do catálogo autorizado e preserve o escopo tenant, empresa e filial. O environment_code identifica exclusivamente a conexão/API e não deve ser usado para relacionar tabelas, campos ou índices.
13. O snapshot SX3 é a única fonte de campos físicos. Um identificador com aparência Protheus, como F1_TOTAL, não é campo válido se não estiver listado em FIELD para a tabela. Para totais calculados, use SUM/COUNT/AVG somente sobre um campo físico listado e atribua um alias de apresentação explícito com AS; o alias não pode ser usado como campo físico, filtro ou chave de JOIN.
14. MUITO IMPORTANTE: Quando utilizar alias em uma tabela no FROM/JOIN (ex: FROM SF2010 SF2), você deve OBRIGATORIAMENTE utilizar ESSE EXATO ALIAS nas colunas do SELECT e WHERE (ex: SF2.F2_DOC).
15. PROIBIÇÃO ABSOLUTA DE ALUCINAÇÃO DE CAMPOS: Você está INVENTANDO campos que não existem no dicionário. NUNCA crie colunas começando com "X" (ex: F2_XCLIENT, F2_X_COND, C5_XNOME, C5_XVEND, C6_XDESC) tentando trazer descrições. Se o usuário pedir o nome do cliente ou fornecedor, mas a tabela de clientes/fornecedores não estiver no snapshot, USE APENAS O CÓDIGO (ex: C5_VEND1, F2_CLIENTE). A invenção de campos inexistentes quebra o AppServer do Protheus. Use a sintaxe INNER JOIN ao invés de apenas JOIN para maior clareza.
17. CONSULTAS GERENCIAIS AGRUPADAS: Se o pedido contiver "agrupado", "agrupando", "por vendedor", "por produto", "por subgrupo", "mensal", "por mês" ou combinação equivalente, a resposta DEVE ser uma agregação SQL real. Selecione cada dimensão solicitada, uma métrica física financeira/quantitativa autorizada usando SUM/COUNT/AVG e inclua no GROUP BY todas as dimensões não agregadas. Nunca trate campos de mês, ano, data, código, filial, empresa, identificador ou número como métrica financeira. Não retorne linhas transacionais detalhadas quando a solicitação exigir consolidação. Se não existir no snapshot um campo físico autorizado para a métrica ou uma dimensão solicitada, não substitua por outro campo: informe que a análise não pode ser construída com o catálogo disponível.
18. COERÊNCIA DO RESULTADO: Para análise mensal do ano, a consulta deve retornar uma coluna de período/mês e uma métrica agregada por mês; para vendedor e subgrupo, deve retornar as respectivas dimensões e a métrica agregada. O alias da métrica deve ser explícito, por exemplo SUM(campo_físico) AS VALOR_TOTAL, sem reutilizar alias ou códigos como valor.
16. TRATAMENTO DE DATAS NO PROTHEUS: O Protheus armazena todos os campos de data no banco Oracle como strings VARCHAR2(8) no formato \'YYYYMMDD\'. NUNCA use TO_CHAR() ou TO_DATE() em um campo nativo do Protheus, senão a conversão falhará e o banco retornará erro 500 no QueryRest. Para filtrar datas, use comparação de string. Exemplo de mês atual: SUBSTR(SF2.F2_EMISSAO, 1, 6) = TO_CHAR(SYSDATE, \'YYYYMM\'). Exemplo de data exata: SF2.F2_EMISSAO = \'20260905\'.
19. PROIBIÇÃO DE CAMPOS DE DATA INVENTADOS (ANO_EMISSAO, MES_EMISSAO, ETC.): NUNCA use ou invente identificadores como ANO_EMISSAO, MES_EMISSAO, DATA_EMISSAO ou DT_EMISSAO no SELECT, WHERE ou GROUP BY. Não existem tais campos no Protheus; o uso deles causa bloqueio imediato pelo RBAC (ENTITLEMENT_DENIED). Para agrupar ou filtrar por mês/ano, use SEMPRE SUBSTR(alias.CAMPO_DATA, 1, 6) AS MES_ANO e use essa mesma expressão SUBSTR(...) no GROUP BY. Para comparar mês atual com anterior, use SUBSTR(alias.CAMPO_DATA, 1, 6) IN (TO_CHAR(ADD_MONTHS(SYSDATE, -1), \'YYYYMM\'), TO_CHAR(SYSDATE, \'YYYYMM\')).
20. SINTAXE GROUP BY NO ORACLE: O banco Oracle NÃO aceita aliases da cláusula SELECT na cláusula GROUP BY. Qualquer expressão projetada (como SUBSTR(...) ou cálculo) DEVE ser repetida de forma idêntica no GROUP BY. Exemplo correto: SELECT SUBSTR(SF2.F2_EMISSAO, 1, 6) AS MES_ANO, SUM(SD2.D2_TOTAL) AS TOTAL ... GROUP BY SUBSTR(SF2.F2_EMISSAO, 1, 6). NUNCA faça 'GROUP BY MES_ANO'.
21. PREFERÊNCIA DE NOMES E QUANTIDADE DE PEDIDOS EM AGRUPAMENTOS:
- NUNCA invente tabelas que NÃO estejam listadas no snapshot autorizado acima! Se uma tabela de cadastro (como SA3 para vendedores, SA1 para clientes, SA2 para fornecedores ou SB1 para produtos) NÃO estiver explicitamente no snapshot autorizado, NUNCA faça JOIN com ela e NUNCA referencie seus campos (ex: NUNCA use A3_NOME se SA3 não estiver no snapshot). Nesses casos, use EXCLUSIVAMENTE os códigos disponíveis nas tabelas autorizadas (ex: SF2.F2_VEND1 AS VENDEDOR ou SF2.F2_CLIENTE AS CLIENTE).
- SE e SOMENTE SE a tabela de cadastro ESTIVER presente no snapshot autorizado:
  * Vendedores (se SA3 constar no snapshot): JOIN SA3010 SA3 ON SF2.F2_VEND1 = SA3.A3_COD (ou SD2.D2_VENDEDOR = SA3.A3_COD) com SA3.D_E_L_E_T_ <> '*' -> projete SA3.A3_NOME AS VENDEDOR.
  * Clientes (se SA1 constar no snapshot): JOIN SA1010 SA1 ON SF2.F2_CLIENTE = SA1.A1_COD AND SF2.F2_LOJA = SA1.A1_LOJA com SA1.D_E_L_E_T_ <> '*' -> projete SA1.A1_NOME AS CLIENTE.
  * Fornecedores (se SA2 constar no snapshot): JOIN SA2010 SA2 ON SF1.F1_FORNECE = SA2.A2_COD AND SF1.F1_LOJA = SA2.A2_LOJA com SA2.D_E_L_E_T_ <> '*' -> projete SA2.A2_NOME AS FORNECEDOR.
  * Produtos (se SB1 constar no snapshot): JOIN SB1010 SB1 ON SD2.D2_COD = SB1.B1_COD com SB1.D_E_L_E_T_ <> '*' -> projete SB1.B1_DESC AS PRODUTO.
- Em consultas de vendas agrupadas por vendedor ou cliente, selecione OBRIGATORIAMENTE a quantidade de pedidos: COUNT(DISTINCT SF2.F2_DOC) AS QTD_PEDIDOS (ou COUNT(DISTINCT SD2.D2_PEDIDO) AS QTD_PEDIDOS), além do valor total faturado SUM(SF2.F2_VALBRUT) AS VALOR_TOTAL. Isso é indispensável para o cálculo correto do Ticket Médio e do Total de Pedidos nos dashboards executivos."""

    if not domain:
        domain = _infer_query_domain(prompt)
    if not domain and history:
        for turn in reversed(history):
            if turn.get("role") == "user":
                past_prompt = turn.get("content") or turn.get("text") or ""
                past_domain = _infer_query_domain(str(past_prompt))
                if past_domain:
                    domain = past_domain
                    break
    domain_instruction = ""
    if domain == "sales":
        domain_instruction = (
            " A intenção é VENDAS/FATURAMENTO. Use SF2/SD2 para notas de saída "
            "(e SA1/SA3 quando essas tabelas constarem explicitamente no snapshot autorizado acima); "
            "nunca use SF1/SD1/SA2, que são entrada/compras/fornecedores. "
            "DIRETRIZES DE VENDAS: "
            "1. ANÁLISE POR VENDEDOR/REPRESENTANTE: "
            "- Se a tabela SA3 constar explicitamente no snapshot autorizado acima, faça INNER JOIN com SA3010 SA3 (SF2.F2_VEND1 = SA3.A3_COD) para projetar SA3.A3_NOME AS VENDEDOR e SF2.F2_VEND1 AS COD_VENDEDOR. "
            "- Se a tabela SA3 NÃO constar no snapshot autorizado acima, NUNCA use SA3 nem A3_NOME (causará bloqueio de segurança RBAC). Projete apenas SF2.F2_VEND1 AS VENDEDOR. "
            "- Selecione OBRIGATORIAMENTE a quantidade de pedidos faturados: COUNT(DISTINCT SF2.F2_DOC) AS QTD_PEDIDOS. "
            "- Selecione o valor total faturado: SUM(SF2.F2_VALBRUT) AS VALOR_TOTAL. "
            "- Agrupe pelas dimensões selecionadas e ordene por VALOR_TOTAL DESC. "
            "2. ANÁLISE POR CLIENTE: "
            "- Se SA1 constar no snapshot, faça INNER JOIN com SA1010 SA1 para trazer SA1.A1_NOME AS CLIENTE. Se não constar, projete apenas SF2.F2_CLIENTE AS CLIENTE. "
            "- Selecione COUNT(DISTINCT SF2.F2_DOC) AS QTD_PEDIDOS e SUM(SF2.F2_VALBRUT) AS VALOR_TOTAL. "
            "3. ANÁLISE POR PRODUTO: "
            "- Se SB1 constar no snapshot, faça INNER JOIN com SB1010 SB1 via SD2.D2_COD = SB1.B1_COD para trazer SB1.B1_DESC AS PRODUTO. Se não constar, projete SD2.D2_COD AS PRODUTO. "
            "- Selecione SUM(SD2.D2_TOTAL) AS VALOR_TOTAL e SUM(SD2.D2_QUANT) AS QUANTIDADE. "
            "4. REGRA DE SEGURANÇA RBAC: NUNCA referencie tabelas ou campos que não estejam explicitamente presentes no snapshot autorizado acima."
        )
    elif domain == "purchases":
        domain_instruction = (
            " A intenção é COMPRAS/ENTRADA. Use SF1/SD1 para notas de entrada "
            "e SA2 para fornecedores quando essas famílias estiverem no catálogo; "
            "não trate tabelas de saída como tabelas de entrada."
        )
    elif domain == "finance":
        domain_instruction = (
            " A intenção é FINANCEIRO (Contas a Receber, Contas a Pagar e Fluxo de Caixa). "
            "1. FLUXO DE CAIXA: Quando o pedido contiver 'fluxo de caixa', 'projeção de caixa' ou comparar 'pagar e receber', "
            "consulte os TÍTULOS EM ABERTO unificando SE1 (contas a receber com E1_SALDO > 0) e SE2 (contas a pagar com E2_SALDO > 0) "
            "através de UNION ALL. Projete obrigatoriamente: 'RECEBIMENTO' AS TIPO_MOVIMENTO para SE1 e 'PAGAMENTO' AS TIPO_MOVIMENTO para SE2, "
            "data de vencimento (SE1.E1_VENCTO / SE2.E2_VENCTO) AS DATA_VENCTO, e o saldo em aberto (SE1.E1_SALDO / SE2.E2_SALDO) AS VALOR. "
            "2. CONTAS A RECEBER / TÍTULOS A RECEBER / VENCIDOS A RECEBER / INADIMPLÊNCIA: Quando a pergunta for sobre títulos a receber ou vencidos a receber, "
            "consulte EXCLUSIVAMENTE a tabela SE1 (SE1010 SE1). Filtre títulos em aberto (SE1.E1_SALDO > 0) e, caso peça 'vencidos', filtre "
            "SE1.E1_VENCTO < TO_CHAR(SYSDATE, 'YYYYMMDD'). Selecione OBRIGATORIAMENTE o nome do cliente (SE1.E1_NOMCLI), o código do cliente (SE1.E1_CLIENTE), "
            "o número do título (SE1.E1_NUM), parcela (SE1.E1_PARCELA), data de vencimento (SE1.E1_VENCTO) e saldo em aberto (SE1.E1_SALDO AS VALOR_SALDO). "
            "O campo de nome do cliente (SE1.E1_NOMCLI) é INDISPENSÁVEL e OBRIGATÓRIO para a identificação dos clientes nos gráficos de barras e rankings executivos. "
            "NUNCA selecione apenas o código sem o nome do cliente! "
            "NUNCA crie coluna TIPO_MOVIMENTO e NUNCA una com a tabela SE2 quando a pergunta for apenas de contas a receber ou títulos vencidos! "
            "3. CONTAS A PAGAR / TÍTULOS A PAGAR / VENCIDOS A PAGAR: Quando a pergunta for sobre contas a pagar, consulte EXCLUSIVAMENTE "
            "a tabela SE2 (SE2010 SE2) com SE2.E2_SALDO > 0. Selecione OBRIGATORIAMENTE o nome do fornecedor (SE2.E2_NOMFOR), código do fornecedor (SE2.E2_FORNECE), "
            "número do título (SE2.E2_NUM), parcela (SE2.E2_PARCELA), vencimento (SE2.E2_VENCTO) e saldo (SE2.E2_SALDO AS VALOR_SALDO). "
            "O campo de nome do fornecedor (SE2.E2_NOMFOR) é INDISPENSÁVEL para os gráficos e rankings executivos. NUNCA selecione apenas o código! NUNCA una com SE1! "
            "4. REGRAS OBRIGATÓRIAS: Sempre aplique D_E_L_E_T_ <> '*' e a filial autorizada. NUNCA use SE5 se SE5 não estiver listada no snapshot autorizado!"
        )


    user_query = f"Gere a instrução SQL em Oracle para responder: {prompt}.{domain_instruction}"

    backend_mode = getattr(settings, "llm_backend", "gemini")
    raw_response = ""

    # 1. Se configurado explicitamente para Ollama / local
    if str(backend_mode).lower() in ("ollama", "local"):
        logger.info("[SQL Generator] Provedor configurado: LLM Local (Ollama - Hetzner).")
        from app.services.ollama_client import ask_llm
        raw_response = await ask_llm(
            question=user_query,
            protheus_data=None,
            intent="sql_generation",
            context={
                "tenant_system_prompt": system_instruction,
                "tenant_id": tenant_id,
                "environment_code": environment_code,
            },
            history=history or [],
            image=image,
            allow_tools=False,
        )
    else:
        # 2. Modo Gemini com fallback automático para Ollama
        try:
            from app.services.gemini_client import ask_gemini
            raw_response = await ask_gemini(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={
                    "tenant_system_prompt": system_instruction,
                    "tenant_id": tenant_id,
                    "environment_code": environment_code,
                },
                history=history or [],
                image=image,
                allow_tools=False,
            )
        except Exception as e:
            logger.warning("[SQL Generator] Falha ao acionar Gemini: %s. Ativando fallback para LLM Local (Hetzner)...", e)
            from app.services.ollama_client import ask_llm
            raw_response = await ask_llm(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={
                    "tenant_system_prompt": system_instruction,
                    "tenant_id": tenant_id,
                    "environment_code": environment_code,
                },
                history=history or [],
                image=image,
                allow_tools=False,
            )

        # 3. Se a resposta retornada contiver erro de quota 429 ou erro da API Gemini
        if raw_response and (
            "429" in raw_response
            or "quota" in raw_response.lower()
            or "rate-limit" in raw_response.lower()
            or raw_response.startswith("Erro na API do Gemini:")
            or raw_response.startswith("Erro de conexão com a API do Gemini:")
            or raw_response.startswith("A inteligência artificial do Google")
        ):
            logger.warning(
                "[SQL Generator] Gemini retornou erro de quota/indisponibilidade (%s). "
                "Ativando fallback imediato para LLM Local (servidor Hetzner)...",
                raw_response[:120]
            )
            from app.services.ollama_client import ask_llm
            raw_response = await ask_llm(
                question=user_query,
                protheus_data=None,
                intent="sql_generation",
                context={
                    "tenant_system_prompt": system_instruction,
                    "tenant_id": tenant_id,
                    "environment_code": environment_code,
                },
                history=history or [],
                image=image,
                allow_tools=False,
            )

    if not raw_response or not isinstance(raw_response, str):
        raise HTTPException(status_code=500, detail="Provedor LLM retornou uma resposta vazia na geração de SQL.")

    if raw_response.startswith("Erro na API do Gemini:") or raw_response.startswith("Erro de conexão com a API do Gemini:") or raw_response.startswith("A inteligência artificial do Google"):
        raise HTTPException(status_code=502, detail=raw_response)

    # Sanitiza blocos de markdown ou comentários ao redor da query
    clean_sql = re.sub(r'```(?:sql)?|```', '', raw_response, flags=re.IGNORECASE).strip()
    
    # Extrai estritamente a partir do SELECT ou WITH e até o ponto-e-vírgula se aplicável
    with_idx = clean_sql.upper().find("WITH")
    sel_idx = clean_sql.upper().find("SELECT")
    if with_idx != -1 and (sel_idx == -1 or with_idx < sel_idx):
        clean_sql = clean_sql[with_idx:].strip()
    elif sel_idx != -1:
        clean_sql = clean_sql[sel_idx:].strip()
    else:
        # Se não há SELECT nem WITH na resposta, provável alucinação ou erro
        raise HTTPException(status_code=500, detail=f"O provedor LLM falhou ao gerar um SELECT/WITH válido. Resposta bruta: {raw_response}")

    if ";" in clean_sql:
        clean_sql = clean_sql.split(";")[0].strip()

    return clean_sql


def _is_catalog_field_validation_error(exc: HTTPException) -> bool:
    """Identifica somente falhas de campo físico; demais bloqueios não têm retry."""
    return (
        exc.status_code == 403
        and "campo(s) físico(s)" in str(exc.detail)
        and ("ausente(s)" in str(exc.detail) or "não autorizado(s)" in str(exc.detail))
    )


_DOMAIN_TABLE_FAMILIES = {
    "sales": {"SF2", "SD2", "SC5", "SC6", "SA1", "SA3", "SE1", "SB1", "SB2", "SF4", "SCJ", "SCK", "DA0", "DA1"},
    "purchases": {"SF1", "SD1", "SC7", "SA2", "SE2", "SB1", "SB2", "SF4", "SC1"},
    "finance": {"SE1", "SE2", "SE5", "SA1", "SA2", "SA6"}
}


def _infer_query_domain(prompt: str) -> str | None:
    normalized = unicodedata.normalize("NFKD", str(prompt or "").lower())
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9 ]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    sales_terms = (
        "venda", "vendas", "vendido", "faturamento", "faturado", "faturada", "faturadas",
        "pedido", "pedidos", "pedido de venda", "pedidos de venda", "notas fiscais de saida", "nota de saida", "notas de saida", "cliente", "clientes",
        "vendedor", "vendedores", "representante", "representantes", "comercial",
    )
    purchase_terms = (
        "compra", "compras", "comprado", "entrada", "entradas", "fornecedor", "fornecedores",
        "nota de entrada", "notas de entrada", "recebimento", "pedido de compra",
    )
    finance_terms = (
        "financeiro", "fluxo de caixa", "receber", "pagar", "contas a receber", "contas a pagar", "inadimplencia", "inadimplência",
        "vencimento", "vencido", "vencidos", "boleto", "boletos", "titulo", "titulos", "se1", "se2", "se5",
        "saldo", "saldo bancario", "movimento bancario"
    )
    
    if any(term in normalized for term in finance_terms):
        return "finance"
    
    has_sales = any(term in normalized for term in sales_terms)
    has_purchases = any(term in normalized for term in purchase_terms)
    if has_sales and not has_purchases:
        return "sales"
    if has_purchases and not has_sales:
        return "purchases"
    return None


def _table_families_from_context(context: list[dict[str, Any]]) -> set[str]:
    families = set()
    for item in context:
        table = item.get("table") or {}
        for value in (
            table.get("table_code"),
            table.get("table_name"),
            table.get("physical_name"),
        ):
            compact = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
            for family in {"SF1", "SD1", "SA2", "SF2", "SD2", "SA1", "SC5", "SC6", "SE1", "SE2", "SB1", "SB2"}:
                if compact.startswith(family):
                    families.add(family)
    return families


def _table_families_from_sql(sql: str) -> set[str]:
    families = set()
    for match in re.finditer(r"\b(?:FROM|JOIN)\s+([A-Z][A-Z0-9_$#]*)", str(sql or "").upper()):
        compact = re.sub(r"[^A-Z0-9]", "", match.group(1))
        for family in {"SF1", "SD1", "SA2", "SF2", "SD2", "SA1", "SC5", "SC6", "SE1", "SE2", "SB1", "SB2"}:
            if compact.startswith(family):
                families.add(family)
    return families



_DOMAIN_INTENT_LABEL = {
    "finance":   "cash_flow",
    "sales":     "sales_billing",
    "purchases": "purchases_entry",
}

_DOMAIN_REQUIRED_TABLES = {
    "finance":   [("SE1", "Contas a Receber"), ("SE2", "Contas a Pagar"), ("SE5", "Movimentação Financeira")],
    "sales":     [("SF2", "Notas de Saída"), ("SD2", "Itens de Saída"), ("SA1", "Clientes")],
    "purchases": [("SF1", "Notas de Entrada"), ("SD1", "Itens de Entrada"), ("SA2", "Fornecedores")],
}

_DOMAIN_SUGGESTED_ACTION = {
    "finance":   "Sincronizar o módulo SIGAFIN (Financeiro) no painel de administração e recarregar o copiloto.",
    "sales":     "Sincronizar o módulo SIGAFAT (Faturamento) no painel de administração e recarregar o copiloto.",
    "purchases": "Sincronizar o módulo SIGACOM (Compras) no painel de administração e recarregar o copiloto.",
}


class DomainDiagnosticResult(dict):
    """Dict que se comporta também como string para manter compatibilidade total com testes legados."""
    def __str__(self) -> str:
        return str(self.get("message", ""))

    def __contains__(self, item: Any) -> bool:
        if isinstance(item, str) and item in str(self.get("message", "")):
            return True
        return super().__contains__(item)


def _domain_catalog_diagnostic(
    domain: str, families_available: set[str], context: list[dict[str, Any]]
) -> DomainDiagnosticResult:
    """Retorna payload diagnóstico estruturado para DOMAIN_CATALOG_MISMATCH."""
    required_list = _DOMAIN_REQUIRED_TABLES.get(domain, [])
    required_codes = [t[0] for t in required_list]
    available_tables = sorted(
        {
            str(item["table"].get("table_code") or item["table"].get("table_name") or "").strip().upper()
            for item in context
            if (item.get("table") or {}).get("table_code") or (item.get("table") or {}).get("table_name")
        }
    )
    missing_tables = [
        {"code": code, "description": desc}
        for code, desc in required_list
        if not any(avail.startswith(code) for avail in families_available)
    ]

    human_messages = {
        "finance":   (
            "A pergunta é financeira (fluxo de caixa/contas a receber/pagar), mas o módulo e o snapshot ativos "
            "não contêm SE1/SE2/SE5. Selecione um módulo financeiro autorizado e sincronize o dicionário antes de consultar."
        ),
        "sales":     (
            "A pergunta é de vendas/faturamento, mas o módulo e o snapshot ativos "
            "não contêm SF2/SD2/SA1. Selecione um módulo de vendas autorizado e sincronize o dicionário antes de consultar."
        ),
        "purchases": (
            "A pergunta é de compras/entrada, mas o módulo e o snapshot ativos "
            "não contêm SF1/SD1/SA2. Selecione um módulo de compras autorizado e sincronize o dicionário antes de consultar."
        ),
    }

    return DomainDiagnosticResult({
        "message": human_messages.get(domain, "Domínio não disponível no snapshot ativo."),
        "intent": _DOMAIN_INTENT_LABEL.get(domain, domain),
        "required_tables": required_codes,
        "missing_tables": missing_tables,
        "available_tables": available_tables[:30],  # limitar tamanho
        "suggested_action": _DOMAIN_SUGGESTED_ACTION.get(domain, "Sincronize o dicionário para o módulo ativo."),
    })


def _domain_context_block(
    prompt: str,
    context: list[dict[str, Any]],
    domain: str | None = None,
) -> dict[str, Any] | None:
    """Retorna dict diagnóstico se o domínio da pergunta não encontrar tabelas no snapshot, ou None."""
    domain = domain or _infer_query_domain(prompt)
    if not domain:
        return None
    families = _table_families_from_context(context)
    required = _DOMAIN_TABLE_FAMILIES[domain]
    if families.isdisjoint(required):
        return _domain_catalog_diagnostic(domain, families, context)
    return None



def _validate_query_domain(prompt: str, sql: str, domain: str | None = None) -> None:
    domain = domain or _infer_query_domain(prompt)
    if not domain:
        return
    families = _table_families_from_sql(sql)
    if domain == "sales":
        if families.intersection({"SF1", "SD1", "SA2"}) and not families.intersection({"SF2", "SD2", "SC5", "SC6", "SA1", "SE1", "SB1", "SB2"}):
            raise HTTPException(
                status_code=422,
                detail="Consulta de vendas gerou tabela de entrada/fornecedor (SF1, SD1 ou SA2); SQL bloqueado.",
            )
    elif domain == "purchases":
        if families.intersection({"SF2", "SD2", "SA1"}) and not families.intersection({"SF1", "SD1", "SC7", "SA2", "SE2", "SB1", "SB2"}):
            raise HTTPException(
                status_code=422,
                detail="Consulta de compras gerou tabela de saída/cliente (SF2, SD2 ou SA1); SQL bloqueado.",
            )
    elif domain == "finance":
        if not families.intersection({"SE1", "SE2", "SE5", "SA1", "SA2"}):
            raise HTTPException(
                status_code=422,
                detail="Consulta financeira gerou SQL sem tabelas financeiras adequadas (SE1, SE2, SE5); SQL bloqueado.",
            )


def _load_conversation_history(
    db: Session,
    tenant_schema: str,
    tenant_id: str,
    company_id: int,
    conversation_id: str,
    actor_key: str,
    limit: int = 12,
) -> list[dict[str, str]]:
    """Carrega somente turnos textuais do escopo exato da conversa.

    A tabela memories é reutilizada como armazenamento de contexto textual;
    linhas, colunas e respostas do ERP nunca são gravadas aqui.
    """
    schema = quote_tenant_schema(tenant_schema)
    rows = db.execute(
        text(f"""
            SELECT memory_key, memory_value
              FROM {schema}.memories
             WHERE tenant_id = :tenant_id
               AND company_id::text = CAST(:company_id AS text)
               AND memory_type = 'conversation_turn'
               AND scope = :conversation_id
               AND source = :actor_key
             ORDER BY created_at ASC, id ASC
             LIMIT :limit
        """),
        {
            "tenant_id": tenant_id,
            # O schema histórico pode armazenar company_id como INTEGER ou
            # VARCHAR(100). O cast no SQL e o valor textual mantêm o filtro
            # compatível sem cruzar o escopo de tenant/empresa.
            "company_id": str(company_id),
            "conversation_id": conversation_id,
            "actor_key": actor_key,
            "limit": limit,
        },
    ).mappings().all()
    return [
        {"role": str(row["memory_key"]), "content": str(row["memory_value"])}
        for row in rows
        if row.get("memory_key") in {"user", "assistant"} and row.get("memory_value")
    ]


def _append_conversation_turn(
    db: Session,
    tenant_schema: str,
    tenant_id: str,
    company_id: int,
    conversation_id: str,
    actor_key: str,
    role: str,
    content: str,
) -> None:
    """Persiste somente texto resumido da conversa, nunca o resultado do ERP."""
    if role not in {"user", "assistant"} or not str(content or "").strip():
        return
    schema = quote_tenant_schema(tenant_schema)
    db.execute(
        text(f"""
            INSERT INTO {schema}.memories
                (tenant_id, company_id, visibility, memory_key, memory_value,
                 memory_type, scope, source)
            VALUES
                (:tenant_id, :company_id, 'private', :role, :content,
                 'conversation_turn', :conversation_id, :actor_key)
        """),
        {
            # String numérica é aceita tanto por instalações com company_id
            # INTEGER quanto por schemas legados com company_id textual.
            "tenant_id": tenant_id,
            "company_id": str(company_id),
            "role": role,
            "content": str(content).strip()[:4000],
            "conversation_id": conversation_id,
            "actor_key": actor_key,
        },
    )


def _normalize_conversation_history(value: Any, limit: int = 12) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value[-limit:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = item.get("content", item.get("text"))
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        content = content.strip()
        if content:
            normalized.append({"role": role, "text": content[:4000]})
    return normalized


def _build_catalog_revision_prompt(prompt: str, rejected_sql: str, reason: str) -> str:
    """Instrui uma única revisão baseada no snapshot, sem sugerir campo substituto."""
    return (
        f"{prompt}\n\n"
        "REVISÃO OBRIGATÓRIA: a primeira consulta foi rejeitada porque contém "
        "identificador físico ausente ou não autorizado no catálogo SX3 do tenant. "
        "Gere novamente a consulta do zero usando exclusivamente os FIELD listados "
        "no snapshot. Não invente um campo substituto. Se precisar de total, aplique "
        "SUM/COUNT/AVG sobre um campo físico listado e use alias explícito com AS. "
        "Não reutilize aliases em WHERE ou JOIN.\n"
        f"Motivo da rejeição: {reason}\n"
        f"SQL rejeitado: {rejected_sql}"
    )


async def process_agent_task(task_id: str, payload: dict):
    started = time.time()
    task_state = AGENT_TASKS.get(task_id) or {}
    correlation_id = task_state.get("correlation_id") or get_correlation_id()
    task_tenant = task_state.get("tenant_id") or payload.get("tenant_id")
    task_state["correlation_id"] = correlation_id
    if task_tenant:
        task_state["tenant_id"] = task_tenant
    AGENT_TASKS[task_id] = task_state
    logger.info("agent_task_started task_id=%s", task_id)
    try:

        execute = payload.get("execute", False)
        
        prompt = payload.get("prompt") or payload.get("query")
        if not prompt:
            AGENT_TASKS[task_id] = {"status": "error", "error": "O campo prompt ou query é obrigatório na v2.", "correlation_id": correlation_id}

            return

        environment_code = str(
            payload.get("environment_code")
            or (payload.get("context") or {}).get("environment_code")
            or ""
        ).strip()
        if not environment_code or environment_code.lower() in {"default", "none", "null"}:
            AGENT_TASKS[task_id] = {
                "status": "error",
                "error": "environment_code real é obrigatório para execução no Protheus.",
                "correlation_id": correlation_id,
            }
            return

        file_data = payload.get("file")

        image_b64 = file_data.get("data") if isinstance(file_data, dict) else None

        import re
        from sqlalchemy import text
        from app.db.database import ensure_tenant_tables
        from app.db.database import resolve_clean_tenant
        from app.services.protheus_context_resolver import resolve_context
        from app.services.protheus_module_catalog import (
            filter_allowed_dictionary_tables,
            load_dictionary_fields,
            load_dictionary_indexes,
        )
        
        with SessionLocal() as db:
            try:
                # 1. Resolve o contexto de forma segura (Tenant, Schema, Módulo, Branch)
                ctx = resolve_context(db, payload)
            except ValueError as ve:
                AGENT_TASKS[task_id] = {"status": "error", "error": str(ve), "correlation_id": correlation_id}

                return

            clean_tenant = ctx.schema_name
            logger.info(
                "agent_context_resolved task_id=%s tenant=%s environment=%s company_id=%s module=%s",
                task_id,
                ctx.tenant_id,
                environment_code,
                ctx.company_id,
                ctx.module_code,
            )
            if clean_tenant and clean_tenant != "public":

                ensure_tenant_tables(db, clean_tenant)
                db.execute(text(f'SET search_path TO {clean_tenant}, public'))
                db.commit()

            # 2. Entitlements: licença, usuário, módulo, consumo e conexões.
            context_payload = payload.get("context") or {}
            session_key = payload.get("session_key") or context_payload.get("session_key") or correlation_id
            conversation_id = str(
                payload.get("conversation_id")
                or payload.get("session_id")
                or context_payload.get("conversation_id")
                or context_payload.get("session_id")
                or session_key
            ).strip()
            user_identity = (
                payload.get("user_id")
                or context_payload.get("user_id")
                or context_payload.get("user")
                or context_payload.get("usuario")
            )
            role_id = payload.get("role_id") or context_payload.get("role_id") or context_payload.get("profile") or context_payload.get("perfil")
            actor_key = str(user_identity or context_payload.get("user") or context_payload.get("usuario") or "anonymous").strip()[:255]
            persisted_history = _load_conversation_history(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_id=str(ctx.tenant_id),
                company_id=ctx.company_id,
                conversation_id=conversation_id,
                actor_key=actor_key,
            )
            conversation_history = _normalize_conversation_history(
                persisted_history + _normalize_conversation_history(payload.get("history"))
            )
            _append_conversation_turn(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_id=str(ctx.tenant_id),
                company_id=ctx.company_id,
                conversation_id=conversation_id,
                actor_key=actor_key,
                role="user",
                content=str(prompt),
            )
            db.commit()
            entitlement_guard = EntitlementGuard()
            try:
                entitlement = entitlement_guard.authorize(
                    db,
                    tenant_code=ctx.tenant_id,
                    environment_code=environment_code,
                    module_code=ctx.module_code,
                    user_identity=str(user_identity) if user_identity else None,
                    role_id=str(role_id) if role_id else None,
                    correlation_id=correlation_id,
                )
            except EntitlementDenied as exc:
                AGENT_TASKS[task_id] = {
                    "status": "error",
                    "error": exc.message,
                    "error_code": exc.code,
                    "correlation_id": correlation_id,
                }
                return

            if not entitlement.allowed:
                logger.warning(
                    "entitlement_shadow_issues task_id=%s codes=%s",
                    task_id,
                    ",".join(issue["code"] for issue in entitlement.issues),
                )

            # 3. Montar contexto XFILIAL
            # O build_protheus_context legada continua operando para gerar a string xfilial
            op_context = build_protheus_context(empresa=ctx.company_code or "", filial=ctx.branch)
            # Para evitar erro nas variáveis, injetamos empresa
            op_context["empresa"] = ctx.company_code or ""
            op_context["filial"] = ctx.branch

            # 4. Carregar dicionário SEGURO (usando o filter novo)
            # Inclui o módulo contextual e todos os módulos contratados ativos do tenant para suportar consultas multi-módulo
            allowed_modules = {str(ctx.module_code)}
            try:
                contracted_rows = db.execute(
                    text("""
                        SELECT DISTINCT pm.mod_code::text
                        FROM public.tenant_module_contracts tmc
                        JOIN public.protheus_modules_master pm ON pm.id::text = tmc.module_id::text
                        WHERE lower(btrim(tmc.tenant_id)) = :tenant_id
                          AND lower(btrim(tmc.status)) IN ('active', 'enabled', 'allowed')
                          AND pm.active = TRUE
                    """),
                    {"tenant_id": str(ctx.tenant_id).lower()},
                ).scalars().all()
                if contracted_rows:
                    allowed_modules.update(str(code) for code in contracted_rows if code)
            except Exception:
                pass

            logger.info({
                "stage": "module_resolution",
                "tenant": str(ctx.tenant_id),
                "context_module_code": str(ctx.module_code),
                "contracted_modules": sorted(list(allowed_modules)),
            })

            tables = filter_allowed_dictionary_tables(
                db=db,
                tenant_schema=ctx.schema_name,
                module_codes=list(allowed_modules),
                company_id=ctx.company_id,
            )

            table_names_in_snapshot = [dict(t).get("table_name") or dict(t).get("table_code") for t in tables]
            logger.info({
                "stage": "snapshot_tables_loaded",
                "tenant": str(ctx.tenant_id),
                "table_count": len(table_names_in_snapshot),
                "tables": sorted(str(n) for n in table_names_in_snapshot if n),
            })

            # O LLM recebe campos e índices por leitores compatíveis com snapshots legados.
            context = []
            for t in tables:
                table_data = dict(t)
                fields = load_dictionary_fields(
                    db=db,
                    tenant_schema=ctx.schema_name,
                    table_code=table_data.get("table_code"),
                    table_name=table_data.get("table_name"),
                )
                blocked_virtuals = {"C5_XNOME", "C5_XVEND", "C6_XDESC", "F2_XCLIENT", "F2_X_COND", "A1_XNOME", "A2_XNOME", "A3_XNOME"}
                fields = [f for f in fields if str(f.get("field_name") or "").strip().upper() not in blocked_virtuals]
                indexes = load_dictionary_indexes(
                    db=db,
                    tenant_schema=ctx.schema_name,
                    table_code=table_data.get("table_code"),
                    table_name=table_data.get("table_name"),
                )

                context.append({
                    "table": table_data,
                    "fields": fields,
                    "indexes": indexes,
                })

            if not context:
                AGENT_TASKS[task_id] = {"status": "error", "error": "Nenhuma tabela liberada ou encontrada no snapshot do dicionário para os filtros informados.", "correlation_id": correlation_id}

                return

            permission_table_names = {
                str(name).strip()
                for item in context
                for name in (
                    item["table"].get("table_name"),
                    item["table"].get("physical_name"),
                    item["table"].get("table_alias"),
                )
                if name
            }
            catalog_fields_by_table = {}
            for item in context:
                table = item.get("table") or {}
                field_names = {
                    str(field.get("field_name") or "").strip().upper()
                    for field in item.get("fields", [])
                    if field.get("field_name")
                }
                for table_name in (
                    table.get("table_name"),
                    table.get("physical_name"),
                ):
                    if table_name and field_names:
                        catalog_fields_by_table.setdefault(str(table_name), set()).update(field_names)

            dictionary_authorization = entitlement_guard.authorize_dictionary_details(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_code=ctx.tenant_id,
                environment_code=environment_code,
                company_id=ctx.company_id,
                role_id=entitlement.role_id,
                table_names=permission_table_names,
                catalog_fields_by_table=catalog_fields_by_table,
            )
            allowed_permission_tables = dictionary_authorization.allowed_tables
            allowed_fields_by_table = dictionary_authorization.allowed_fields_by_table
            allowed_filter_fields_by_table = dictionary_authorization.filter_fields_by_table
            masked_fields = {
                field_name
                for field_names in dictionary_authorization.masked_fields_by_table.values()
                for field_name in field_names
            }
            if entitlement_guard.mode == "enforce":
                if not allowed_permission_tables:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": "Nenhuma permissão de tabela autoriza consultas para o perfil informado.",
                        "error_code": "TABLE_PERMISSION_DENIED",
                        "correlation_id": correlation_id,
                    }
                    return
                if not allowed_fields_by_table:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": "Nenhuma permissão de campo autoriza retorno para o perfil informado.",
                        "error_code": "FIELD_PERMISSION_DENIED",
                        "correlation_id": correlation_id,
                    }
                    return

                permission_tokens = {str(value).strip().upper() for value in allowed_permission_tables}
                filtered_context = []
                for item in context:
                    table = item["table"]
                    table_tokens = {
                        str(name).strip().upper()
                        for name in (
                            table.get("table_name"),
                            table.get("physical_name"),
                        )
                        if name
                    }
                    matched_tokens = table_tokens & permission_tokens
                    if not matched_tokens:
                        continue
                    permitted_fields = {
                        str(field_name).strip().upper()
                        for token in matched_tokens
                        for field_name in allowed_fields_by_table.get(token, set())
                    }
                    visible_fields = [
                        field for field in item.get("fields", [])
                        if str(field.get("field_name") or "").strip().upper() in permitted_fields
                    ]
                    if not visible_fields:
                        continue
                    filtered_context.append({**item, "fields": visible_fields})

                context = filtered_context
                if not context:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": "As permissões do perfil não autorizam campos selecionáveis nas tabelas do snapshot.",
                        "error_code": "FIELD_PERMISSION_DENIED",
                        "correlation_id": correlation_id,
                    }
                    return

            query_domain = _infer_query_domain(str(prompt))
            if not query_domain and conversation_history:
                for turn in reversed(conversation_history):
                    if turn.get("role") == "user":
                        past_prompt = turn.get("content") or turn.get("text") or ""
                        past_domain = _infer_query_domain(str(past_prompt))
                        if past_domain:
                            query_domain = past_domain
                            logger.info(
                                "query_domain_inherited_from_history task_id=%s domain=%s past_prompt=%s",
                                task_id, query_domain, str(past_prompt)[:50]
                            )
                            break

            domain_block = _domain_context_block(str(prompt), context, domain=query_domain)
            if domain_block:
                try:
                    from app.services.business import evaluate_tenant_business_health
                    evaluate_tenant_business_health(db, ctx.schema_name, domain_block.get("intent", "unknown"), context)
                except Exception:
                    pass
                AGENT_TASKS[task_id] = {
                    "status": "error",
                    "error": domain_block["message"],
                    "error_code": "DOMAIN_CATALOG_MISMATCH",
                    "intent": domain_block.get("intent"),
                    "required_tables": domain_block.get("required_tables"),
                    "missing_tables": domain_block.get("missing_tables"),
                    "available_tables": domain_block.get("available_tables"),
                    "suggested_action": domain_block.get("suggested_action"),
                    "conversation_id": conversation_id,
                    "correlation_id": correlation_id,
                }
                return

            if query_domain:
                domain_families = _DOMAIN_TABLE_FAMILIES[query_domain]
                focused_context = [
                    item for item in context
                    if _table_families_from_context([item]).intersection(domain_families)
                ]
                if focused_context:
                    # Mantém apenas tabelas do domínio identificado no prompt; a
                    # autorização já foi calculada sobre o snapshot completo e os
                    # nomes/fields abaixo continuam sendo derivados do catálogo real.
                    context = focused_context
                else:
                    # Nenhuma tabela do domínio está no snapshot ativo.
                    # Retornar erro imediato evita enviar centenas de tabelas ao LLM
                    # (causaria timeout de 120s+ sem resultado útil).
                    families_now = _table_families_from_context(context)
                    diag = _domain_catalog_diagnostic(query_domain, families_now, context)
                    try:
                        from app.services.business import evaluate_tenant_business_health
                        evaluate_tenant_business_health(db, ctx.schema_name, diag.get("intent", "unknown"), context)
                    except Exception:
                        pass
                    logger.warning(
                        "agent_domain_mismatch_early_exit task_id=%s domain=%s",
                        task_id, query_domain,
                    )
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": diag["message"],
                        "error_code": "DOMAIN_CATALOG_MISMATCH",
                        "intent": diag.get("intent"),
                        "required_tables": diag.get("required_tables"),
                        "missing_tables": diag.get("missing_tables"),
                        "available_tables": diag.get("available_tables"),
                        "suggested_action": diag.get("suggested_action"),
                        "conversation_id": conversation_id,
                        "correlation_id": correlation_id,
                    }
                    return

            context_text = render_context_for_prompt(context)
            allowed_table_names = {
                str(name).strip()
                for item in context
                for name in (
                    item["table"].get("table_name"),
                    item["table"].get("physical_name"),
                    item["table"].get("table_alias"),
                )
                if name
            }
            allowed_field_names = {
                str(field.get("field_name")).upper()
                for item in context
                for field in item.get("fields", [])
                if field.get("field_name")
            }

            # 4. LLM
            sql = await real_llm_sql_generator(
                prompt=str(prompt),
                context_text=context_text,
                empresa=op_context["empresa"],
                filial=op_context["filial"],
                xfilial=op_context["xfilial"],
                tenant_id=str(ctx.tenant_id),
                environment_code=environment_code,
                image=image_b64,
                history=conversation_history,
                domain=query_domain,
            )
            _validate_query_domain(str(prompt), sql, domain=query_domain)

            # 5. Segurança. Um campo ausente do SX3 nunca é liberado. Quando a
            # primeira geração inventar um identificador, o LLM recebe uma única
            # oportunidade de reconstruir o SQL usando o mesmo snapshot autorizado.
            validation_args = {
                "allowed_tables": allowed_table_names,
                "allowed_fields": allowed_field_names,
                "allowed_fields_by_table": allowed_fields_by_table,
                "filter_fields_by_table": allowed_filter_fields_by_table,
                "filial": op_context["xfilial"],
            }

            # Log de diagnóstico RBAC: mostra exatamente o que foi autorizado vs o que o LLM usou
            logger.info({
                "stage": "rbac_validation_start",
                "task_id": task_id,
                "query_domain": query_domain,
                "authorized_tables": sorted(str(t) for t in allowed_table_names),
                "authorized_field_count": len(allowed_field_names),
            })

            try:
                validate_query_security(sql=sql, **validation_args)
            except HTTPException as exc:
                is_field_error = _is_catalog_field_validation_error(exc)
                is_table_error = isinstance(exc, CatalogValidationError)

                logger.warning({
                    "stage": "rbac_validation_failed",
                    "task_id": task_id,
                    "query_domain": query_domain,
                    "error": str(exc.detail),
                    "error_type": "table_not_in_catalog" if is_table_error else "field_not_authorized",
                    "authorized_tables": sorted(str(t) for t in allowed_table_names),
                    "authorized_field_count": len(allowed_field_names),
                    "hint": "Verifique se as tabelas do domínio (SE1/SE2/SE5 para FINANCEIRO) estão importadas no dicionário SX3 do tenant.",
                })

                if not is_field_error and not is_table_error:
                    # Erro de segurança não recuperável (ex: SELECT *, DML, etc.)
                    raise

                if is_table_error:
                    # LLM usou tabela fora do snapshot; fornecer lista exata das tabelas disponíveis
                    available_sorted = sorted(
                        t for t in allowed_table_names
                        if not t.endswith("010") or t[:-3] not in allowed_table_names
                    )
                    retry_reason = (
                        f"A consulta anterior foi rejeitada porque referenciou tabela(s) não disponível(is) "
                        f"no dicionário autorizado deste tenant.\n"
                        f"Tabelas autorizadas disponíveis: {', '.join(available_sorted)}.\n"
                        f"Reescreva a consulta usando APENAS as tabelas listadas acima. "
                        f"Para 'Fluxo de Caixa', use SE1 (contas a receber) e SE2 (contas a pagar) "
                        f"com UNION ALL em vez de SE5.\n"
                        f"Pergunta original: {prompt}"
                    )
                    logger.warning(
                        "agent_sql_catalog_retry task_id=%s reason=table_not_in_catalog available=%s",
                        task_id,
                        available_sorted,
                    )
                else:
                    # LLM usou campo fora do SX3; fornecer a mensagem de erro original
                    retry_reason = _build_catalog_revision_prompt(str(prompt), sql, str(exc.detail))
                    logger.warning(
                        "agent_sql_catalog_retry task_id=%s reason=physical_field_not_in_catalog",
                        task_id,
                    )

                sql = await real_llm_sql_generator(
                    prompt=retry_reason,
                    context_text=context_text,
                    empresa=op_context["empresa"],
                    filial=op_context["filial"],
                    xfilial=op_context["xfilial"],
                    tenant_id=str(ctx.tenant_id),
                    environment_code=environment_code,
                    image=image_b64,
                    history=conversation_history,
                    domain=query_domain,
                )
                _validate_query_domain(str(prompt), sql, domain=query_domain)
                validate_query_security(sql=sql, **validation_args)


            context_tables = [
                {
                    "table_code": item["table"].get("table_code"),
                    "table_name": item["table"].get("table_name"),
                    "physical_name": item["table"].get("physical_name") or item["table"].get("table_alias"),
                    "description": item["table"].get("description"),
                    "module_code": item["table"].get("module_code"),
                }
                for item in context
            ]
            response = {
                "status": "success",
                                    "correlation_id": correlation_id,
                    "conversation_id": conversation_id,
                    "tenant_id": str(ctx.tenant_id),
                "domain": query_domain,
                "intent": _DOMAIN_INTENT_LABEL.get(query_domain, query_domain) if query_domain else None,

                "environment_code": environment_code,
                "company_id": ctx.company_id,
                "context_operational": op_context,
                "tables_in_context": len(context),
                "tables_used": context_tables,
                "sql": sql,
                "entitlement": entitlement.as_dict(),
                "response_time_ms": int((time.time() - started) * 1000),
            }

            # 6. QueryRest
            if execute:
                try:
                    entitlement_guard.reserve(
                        db,
                        entitlement,
                        session_key=str(session_key),
                        correlation_id=correlation_id,
                    )
                except EntitlementDenied as exc:
                    AGENT_TASKS[task_id] = {
                        "status": "error",
                        "error": exc.message,
                        "error_code": exc.code,
                        "correlation_id": correlation_id,
                    }
                    return

                logger.info(
                    "agent_queryrest_start task_id=%s tenant=%s environment=%s",
                    task_id,
                    ctx.tenant_id,
                    environment_code,
                )
                try:
                    rows = await queryrest_exec_tenant(

                        db=db,
                        tenant_id=str(ctx.tenant_id),
                        company_id=ctx.company_id,
                        query=sql,
                        environment_code=environment_code,


                    )
                    safe_rows = mask_sensitive_rows(
                        rows,
                        masked_fields=masked_fields if entitlement_guard.mode == "enforce" else None,
                    )
                    response["records"] = len(rows)
                    response["data"] = safe_rows
                    if safe_rows and isinstance(safe_rows[0], dict):
                        response["result"] = _build_semantic_result(safe_rows)
                        response["result"]["metadata"] = {
                            **response["result"].get("metadata", {}),
                            "domain": query_domain,
                            "intent": _DOMAIN_INTENT_LABEL.get(query_domain, query_domain) if query_domain else None,
                        }
                    else:
                        response["result"] = {
                            "columns": [],
                            "rows": safe_rows,
                            "metadata": {
                                "row_count": len(rows),
                                "source": "queryrest",
                                "domain": query_domain,
                                "intent": _DOMAIN_INTENT_LABEL.get(query_domain, query_domain) if query_domain else None,
                            },
                            "dimensions": [], "measures": [], "kpis": [], "series": []
                        }

                    if len(rows) == 0:
                        response["message"] = "Consulta concluída sem registros."
                        response["result"] = {
                            "columns": [],
                            "rows": [],
                            "metadata": {
                                "row_count": 0,
                                "source": "queryrest",
                                "domain": query_domain,
                                "intent": _DOMAIN_INTENT_LABEL.get(query_domain, query_domain) if query_domain else None,
                            },
                            "dimensions": [], "measures": [], "kpis": [], "series": []
                        }
                        logger.info("agent_queryrest_success task_id=%s records=0", task_id)
                    elif safe_rows and isinstance(safe_rows[0], dict):
                        logger.info("agent_queryrest_success task_id=%s records=%s", task_id, len(rows))
                        response["summary"] = (
                            f"A consulta ao Protheus retornou {len(rows)} registros. "
                            "Os dados estruturados estão disponíveis na tabela e nas visualizações do relatório."
                        )
                        
                        # O resumo é determinístico e derivado de todas as linhas retornadas.
                        # Não usamos uma amostra no LLM para evitar totais, atribuições ou
                        # agrupamentos que não estejam sustentados pelo resultado real.
                        response["message"] = _build_safe_result_summary(safe_rows)
                    else:
                        logger.info("agent_queryrest_success task_id=%s records=%s", task_id, len(rows))
                        response["message"] = "Consulta concluída."
                        response["summary"] = f"A consulta retornou {len(rows)} registros, mas o formato recebido não é tabular."
                except HTTPException as http_ex:
                    error_info = _normalized_http_exception(
                        http_ex,
                        correlation_id,
                        default_source="protheus_queryrest",
                    )
                    
                    if isinstance(http_ex, CatalogValidationError):
                        response["status"] = "validation_failed"
                        response["error_code"] = http_ex.code
                        error_info["error_code"] = http_ex.code
                    elif http_ex.status_code == 403:
                        response["status"] = "forbidden"
                        response["error_code"] = "ENTITLEMENT_DENIED"
                    else:
                        response["status"] = "execution_failed"
                        response["error_code"] = "PROTHEUS_QUERYREST_ERROR"

                    response["message"] = error_info["message"]
                    response["retryable"] = False
                    response["result"] = None
                    # backward compatibility
                    response["execution_error"] = error_info["message"]
                    response.update(error_info)
                    logger.warning(
                        "agent_queryrest_failed task_id=%s status=%s error_code=%s",
                        task_id,
                        http_ex.status_code,
                        error_info["error_code"],
                    )
                finally:
                    if entitlement.lease_key:
                        entitlement_guard.release_session(db, ctx.tenant_id, entitlement.lease_key)

            AGENT_TASKS[task_id] = response
            if response.get("status") == "success":
                assistant_memory = "A consulta anterior foi processada pelo Protheus."
            elif response.get("status") == "execution_failed":
                assistant_memory = "A consulta anterior não foi executada porque o QueryRest retornou falha."
            else:
                assistant_memory = "A consulta anterior foi bloqueada pelas regras de segurança."
            _append_conversation_turn(
                db=db,
                tenant_schema=ctx.schema_name,
                tenant_id=str(ctx.tenant_id),
                company_id=ctx.company_id,
                conversation_id=conversation_id,
                actor_key=actor_key,
                role="assistant",
                content=assistant_memory,
            )
            db.commit()
            logger.info("agent_task_completed task_id=%s status=%s elapsed_ms=%s", task_id, response.get("status"), response.get("response_time_ms"))

    except HTTPException as e:
        error_info = _normalized_http_exception(e, correlation_id)
        
        if isinstance(e, CatalogValidationError):
            AGENT_TASKS[task_id] = {
                "status": "validation_failed",
                "error": str(e.detail),
                "error_code": e.code,
                "correlation_id": correlation_id,
                "tenant_id": task_tenant,
            }
        elif e.status_code == 403:
            AGENT_TASKS[task_id] = {
                "status": "forbidden",
                "error": e.detail,
                "error_code": "ENTITLEMENT_DENIED",
                "correlation_id": correlation_id,
                "tenant_id": task_tenant,
            }
        else:
            AGENT_TASKS[task_id] = {
                "status": "error",
                "error": error_info["message"],
                "tenant_id": task_tenant,
                **error_info,
            }
        logger.warning(
            "agent_task_failed task_id=%s status=%s error_source=%s error_code=%s",
            task_id,
            e.status_code,
            error_info["error_source"],
            AGENT_TASKS[task_id].get("error_code") or error_info["error_code"],
        )
    except ProgrammingError as e:
        db_error = str(e).splitlines()[0][:240]
        error_info = _normalized_agent_error(
            message="O catálogo ou o schema do banco está incompatível com a versão do backend.",
            status_code=500,
            correlation_id=correlation_id,
            default_source="database",
        )
        AGENT_TASKS[task_id] = {
            "status": "error",
            "error": error_info["message"],
            "error_code": "DATABASE_SCHEMA_MISMATCH",
            **error_info,
        }
        logger.error(
            "agent_task_failed task_id=%s error_type=ProgrammingError db_error=%s error_source=%s",
            task_id,
            db_error,
            error_info["error_source"],
        )
    except Exception as e:
        error_info = _normalized_agent_error(
            message="Falha interna ao processar a tarefa.",
            status_code=500,
            correlation_id=correlation_id,
            default_source="internal",
        )
        AGENT_TASKS[task_id] = {
            "status": "error",
            "error": error_info["message"],
            **error_info,
        }
        logger.error(
            "agent_task_failed task_id=%s error_type=%s error_source=%s",
            task_id,
            type(e).__name__,
            error_info["error_source"],
        )

class QueryRestProxyRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=100)
    environment_code: str = Field(..., min_length=1, max_length=100)
    query: str = Field(..., min_length=1, max_length=100000)
    company_id: int | str | None = None
    context: Dict[str, Any] = Field(default_factory=dict)


@router.post("/queryrest")
async def queryrest_proxy(
    payload: QueryRestProxyRequest,
    current_user: dict = Depends(require_current_user),
) -> Dict[str, Any]:
    """Executa uma consulta somente leitura recebida do gateway autenticado."""
    token_tenant = str(
        current_user.get("tenant_id")
        or current_user.get("tenantId")
        or ""
    ).strip()
    if not token_tenant:
        raise HTTPException(
            status_code=401,
            detail="JWT sem tenant_id; consulta QueryRest bloqueada.",
        )
    if token_tenant != "public" and token_tenant.lower() != payload.tenant_id.strip().lower():
        raise HTTPException(
            status_code=403,
            detail="O tenant do JWT não corresponde ao tenant da consulta.",
        )

    context_payload = {
        **payload.context,
        "tenant_id": payload.tenant_id,
        "environment_code": payload.environment_code,
    }
    if payload.company_id is not None:
        context_payload["company_id"] = payload.company_id

    from sqlalchemy import text
    from app.db.database import ensure_tenant_tables
    from app.services.protheus_context_resolver import resolve_context
    from app.services.protheus_module_catalog import filter_allowed_dictionary_tables

    with SessionLocal() as db:
        try:
            ctx = resolve_context(
                db,
                {
                    "tenant_id": payload.tenant_id,
                    "environment_code": payload.environment_code,
                    "company_id": payload.company_id,
                    "context": context_payload,
                },
            )
            ensure_tenant_tables(db, ctx.schema_name)
            db.execute(text(f'SET search_path TO "{ctx.schema_name}", public'))
            db.commit()

            tables = filter_allowed_dictionary_tables(
                db=db,
                tenant_schema=ctx.schema_name,
                module_codes=[ctx.module_code],
                company_id=ctx.company_id,
            )
            allowed_table_names = {
                name
                for table in tables
                for name in (table.get("table_name"), table.get("physical_name"))
                if name
            }
            if not allowed_table_names:
                raise HTTPException(
                    status_code=403,
                    detail="Nenhuma tabela está autorizada para o contexto informado.",
                )

            validate_query_security(
                sql=payload.query,
                allowed_tables=allowed_table_names,
                filial=ctx.branch,
            )
            rows = await queryrest_exec_tenant(
                db=db,
                tenant_id=ctx.tenant_id,
                company_id=ctx.company_id,
                query=payload.query,
                environment_code=payload.environment_code,
            )
            return {
                "status": "success",
                "tenant_id": ctx.tenant_id,
                "environment_code": payload.environment_code,
                "records": len(rows),
                "items": rows,
            }
        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            logger.error(
                "queryrest_proxy_failed tenant=%s environment=%s error_type=%s",
                payload.tenant_id,
                payload.environment_code,
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=502,
                detail="Falha na execução do QueryRest do Protheus.",
            ) from exc


@router.post("/ask/v2")
@router.post("/ask/v2/")
async def ask_v2(payload: dict, current_user: dict = Depends(require_current_user)) -> Dict[str, Any]:
    authenticated_tenant = current_user.get("tenant_id")
    requested_tenant = payload.get("tenant_id")
    
    if requested_tenant and requested_tenant != authenticated_tenant:
        raise HTTPException(
            status_code=403,
            detail="Contexto da solicitação não autorizado."
        )
        
    payload["tenant_id"] = authenticated_tenant
    payload["role"] = current_user.get("role")
    payload["user_id"] = current_user.get("user_id") or current_user.get("sub")
    
    environment_code = str(
        payload.get("environment_code")
        or (payload.get("context") or {}).get("environment_code")
        or ""
    ).strip()
    if not authenticated_tenant or authenticated_tenant == "default" or environment_code.lower() in {"", "default", "none", "null"}:
        return {"summary": "Desculpe, mas eu preciso estar aberto dentro do ERP Protheus (com um contexto válido) para executar consultas no banco de dados."}

    task_id = str(uuid.uuid4())
    correlation_id = get_correlation_id()
    AGENT_TASKS[task_id] = {"status": "processing", "correlation_id": correlation_id, "tenant_id": authenticated_tenant}
    logger.info("agent_task_accepted task_id=%s", task_id)
    asyncio.create_task(process_agent_task(task_id, payload))
    return {"status": "processing", "task_id": task_id, "correlation_id": correlation_id}

@router.post("/ask/v2/upload")
async def ask_v2_upload(
    tenant_id: str = Form(...),
    environment_code: str = Form(...),
    company_id: str | None = Form(None),
    query: str = Form(...),
    context: str = Form("{}"),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_current_user),
):
    """Enfileira análise de arquivo usando o mesmo fluxo agent-sql OAuth2."""
    authenticated_tenant = current_user.get("tenant_id")
    requested_tenant = str(tenant_id or "").strip()
    
    if requested_tenant and requested_tenant != authenticated_tenant:
        raise HTTPException(
            status_code=403,
            detail="Contexto da solicitação não autorizado."
        )

    clean_tenant = str(authenticated_tenant or "").strip()
    clean_environment = str(environment_code or "").strip()
    if not clean_tenant or clean_tenant.lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="tenant_id real é obrigatório.")
    if not clean_environment or clean_environment.lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="environment_code real é obrigatório.")
    if not query.strip():
        raise HTTPException(status_code=400, detail="O campo query é obrigatório.")

    try:
        parsed_context = json.loads(context or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="context deve ser um objeto JSON válido.") from exc
    if not isinstance(parsed_context, dict):
        raise HTTPException(status_code=400, detail="context deve ser um objeto JSON.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Arquivo excede o limite permitido.")

    payload = {
        "query": query,
        "tenant_id": clean_tenant,
        "role": current_user.get("role"),
        "user_id": current_user.get("user_id") or current_user.get("sub"),
        "environment_code": clean_environment,
        "company_id": company_id,
        "execute": True,
        "context": {
            **parsed_context,
            "tenant_id": clean_tenant,
            "environment_code": clean_environment,
        },
        "file": {
            "name": file.filename or "upload",
            "content_type": file.content_type or "application/octet-stream",
            "data": base64.b64encode(content).decode("ascii"),
        },
    }

    task_id = str(uuid.uuid4())
    correlation_id = get_correlation_id()
    AGENT_TASKS[task_id] = {"status": "processing", "correlation_id": correlation_id, "tenant_id": authenticated_tenant}
    logger.info("agent_task_accepted task_id=%s", task_id)
    asyncio.create_task(process_agent_task(task_id, payload))
    return {"status": "processing", "task_id": task_id, "correlation_id": correlation_id}


@router.get("/ask/v2/status/{task_id}")
@router.get("/ask/v2/status/{task_id}/")
async def ask_v2_status(task_id: str, current_user: dict = Depends(require_current_user)):

    if task_id not in AGENT_TASKS:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
        
    authenticated_tenant = current_user.get("tenant_id")
    task_tenant = AGENT_TASKS[task_id].get("tenant_id")
    if task_tenant and task_tenant != authenticated_tenant:
        raise HTTPException(status_code=403, detail="Contexto da solicitação não autorizado.")
    
    # Mantém os campos error/error_code e também summary por compatibilidade com clientes antigos,
    # além dos novos campos diagnósticos da BKL (intent, missing_tables, etc.).
    task_status = AGENT_TASKS[task_id].get("status")
    if task_status in ("error", "forbidden", "validation_failed"):
        task = AGENT_TASKS[task_id]
        return {
            "status": "error" if task_status in ("error", "forbidden", "validation_failed") else task_status,
            "error": task.get("error") or task.get("summary"),
            "error_code": task.get("error_code") or ("ENTITLEMENT_DENIED" if task_status == "forbidden" else "TASK_ERROR"),
            "summary": task.get("error") or task.get("summary"),
            "conversation_id": task.get("conversation_id"),
            "correlation_id": task.get("correlation_id"),
            "intent": task.get("intent"),
            "required_tables": task.get("required_tables"),
            "missing_tables": task.get("missing_tables"),
            "available_tables": task.get("available_tables"),
            "suggested_action": task.get("suggested_action"),
        }

    return AGENT_TASKS[task_id]


from fastapi.responses import StreamingResponse
from app.core.log_streamer import stream_manager

@router.get("/stream-logs")
async def stream_logs():
    """
    Endpoint SSE (Server-Sent Events) para transmissão do log do backend em tempo real
    para o chat do Copilot (quando comando /log é acionado).
    """
    return StreamingResponse(
        stream_manager.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
