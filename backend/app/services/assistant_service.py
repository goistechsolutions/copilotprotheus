from sqlalchemy.orm import Session
from app.services.gemini_client import ask_gemini
from app.services.rag_service import RAGService
from app.crud.knowledge_crud import KnowledgeCRUD
from app.core.audit import AuditService
from app.models.knowledge import Tenant
import os, time, asyncio

class AssistantService:
    def __init__(self, db: Session):
        self.db = db
        self.rag = RAGService(db)
        self.crud = KnowledgeCRUD(db)
        self.audit = AuditService(db)

    def _load_tenant_config(self, tenant_id: str) -> dict:
        """Carrega configurações personalizadas do tenant (system_prompt, temperature)."""
        tenant_cfg = {"system_prompt": None, "temperature": None}
        try:
            tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if tenant:
                if tenant.system_prompt:
                    tenant_cfg["system_prompt"] = tenant.system_prompt
                if tenant.temperature is not None:
                    tenant_cfg["temperature"] = tenant.temperature
        except Exception as e:
            print(f"Aviso: Não foi possível carregar config do tenant {tenant_id}: {e}")
        return tenant_cfg

    async def answer_question(self, payload, ctx: dict) -> dict:
        start_time = time.time()
        question      = payload.question
        intent        = payload.intent or "geral"
        protheus_data = payload.protheus_data or {}
        history       = payload.history or []

        # 1. Obter o tenant_id (obrigatório para SaaS)
        tenant_id = ctx.get("tenant_id") or "default"

        # 1.1 Carregar configurações personalizadas do tenant (system_prompt, temperature)
        tenant_cfg = self._load_tenant_config(tenant_id)
        ctx['tenant_system_prompt'] = tenant_cfg['system_prompt']
        ctx['tenant_temperature'] = tenant_cfg['temperature']

        # 1.2 Checar Limite de Tokens (Licença)
        try:
            from app.models.knowledge import Company, CompanyLicense, ApiUsageLog
            from sqlalchemy import func
            company = self.db.query(Company).filter(Company.tenant_id == tenant_id).first()
            if company:
                license_data = self.db.query(CompanyLicense).filter(CompanyLicense.company_id == company.id).first()
                if license_data and not license_data.allow_overage:
                    limit = license_data.max_tokens_monthly
                    usage = self.db.query(func.sum(ApiUsageLog.total_tokens)).filter(ApiUsageLog.company_id == company.id).scalar() or 0
                    if usage >= limit:
                        return {
                            "answer": "Limite de tokens excedido. O serviço de IA está bloqueado para esta empresa. O consumo excedente não está permitido nas configurações de licença.",
                            "audit_id": None
                        }
        except Exception as e:
            print(f"Erro ao checar licença: {e}")

        # 2. Fetch Documentary Context from RAG
        rag_docs = self.rag.search(question, tenant_id=tenant_id, limit=3)
        doc_context = "\n".join([f"- {d['title']} (Página {d['page_number']}): {d['content']}" for d in rag_docs])
        
        # 3. Fetch Persistent Memory
        memories = self.crud.list_memories(tenant_id=tenant_id, limit=10)
        mem_context = "\n".join([f"- {m['memory_key']}: {m['memory_value']}" for m in memories])

        # 4. Augment Context
        ctx['document_context'] = doc_context
        ctx['memory_context'] = mem_context

        # NOVO: Metric Engine + Validation Engine
        from app.services.analytics_engine import AnalyticsEngine
        kpis = {}
        if protheus_data:
            kpis = AnalyticsEngine.process(intent, protheus_data)
            ctx['kpis'] = kpis
            
            # Adicionar regra rígida ao prompt de sistema
            if not ctx.get('tenant_system_prompt'):
                ctx['tenant_system_prompt'] = ""
            ctx['tenant_system_prompt'] += "\n\nREGRA CRITICA DE ANALYTICS: Você é um analista executivo. Use SOMENTE os indicadores fornecidos em 'kpis' no contexto. NUNCA recalcule totais. NUNCA estime percentuais. NUNCA derive métricas inexistentes. Se uma métrica for inconsistente ou marcada com erro, sinalize erro de dados. Baseie sua resposta APENAS nos KPIs calculados pelo backend."

        # 5. Generate Answer with Timeout (reduzido para evitar 504 do Cloudflare)
        # Cloudflare tem hard limit de 100s. Vamos usar 75s para o principal e desistir se passar.
        timeout_sec = 75
        status_audit = "S"
        answer = ""
        try:
            answer = await asyncio.wait_for(
                ask_gemini(
                    question=question,
                    protheus_data=protheus_data if protheus_data else None,
                    intent=intent,
                    context=ctx,
                    history=history,
                    image=payload.image,
                ),
                timeout=timeout_sec,
            )
        except asyncio.TimeoutError:
            answer = "O serviço Gemini excedeu o tempo limite. A consulta não foi concluída."
            status_audit = "T"
        except Exception:
            answer = "O serviço Gemini está temporariamente indisponível. A consulta não foi concluída."
            status_audit = "E"
        
        # Calcular volume de registros retornados do Protheus
        records_returned = 0
        if isinstance(protheus_data, dict):
            if "items" in protheus_data and isinstance(protheus_data["items"], list):
                records_returned = len(protheus_data["items"])
            else:
                records_returned = sum(len(v) for v in protheus_data.values() if isinstance(v, list))

        elapsed_ms = int((time.time() - start_time) * 1000)

        # 6. Audit Log
        try:
            audit_answer = answer
            if status_audit == "T":
                audit_answer = f"[TIMEOUT] {answer}"
            elif status_audit == "E":
                audit_answer = f"[ERROR] {answer}"

            self.audit.save({
                "tenant_id": tenant_id,
                "user_name": payload.user,
                "session_id": payload.session_id,
                "question": question,
                "answer": audit_answer,
                "module": payload.module,
                "company": payload.company,
                "branch": payload.branch,
                "environment": payload.environment,
                "station": payload.station,
                "intent": intent,
                "confidence": 0.9,
                "response_time_ms": elapsed_ms,
                "data_volume": len(audit_answer),
            })
        except Exception as e:
            print(f"Failed to save audit log: {e}")

        return {
            "answer": answer,
            "intent": intent,
            "backend": "gemini",
            "records_returned": records_returned,
            "response_time_ms": elapsed_ms,
            "status": status_audit,
            "kpis": kpis
        }

    async def answer_question_stream(self, payload, ctx: dict):
        start_time = time.time()
        question      = payload.question
        intent        = payload.intent or "geral"
        protheus_data = payload.protheus_data or {}
        history       = payload.history or []

        # 1. Obter o tenant_id (obrigatório para SaaS)
        tenant_id = ctx.get("tenant_id") or "default"

        # 1.1 Carregar configurações personalizadas do tenant (system_prompt, temperature)
        tenant_cfg = self._load_tenant_config(tenant_id)
        ctx['tenant_system_prompt'] = tenant_cfg['system_prompt']
        ctx['tenant_temperature'] = tenant_cfg['temperature']

        # 2. Fetch Documentary Context from RAG
        rag_docs = self.rag.search(question, tenant_id=tenant_id, limit=3)
        doc_context = "\n".join([f"- {d['title']} (Página {d['page_number']}): {d['content']}" for d in rag_docs])
        
        # 3. Fetch Persistent Memory
        memories = self.crud.list_memories(tenant_id=tenant_id, limit=10)
        mem_context = "\n".join([f"- {m['memory_key']}: {m['memory_value']}" for m in memories])

        # 4. Augment Context
        ctx['document_context'] = doc_context
        ctx['memory_context'] = mem_context

        # NOVO: Metric Engine + Validation Engine
        from app.services.analytics_engine import AnalyticsEngine
        kpis = {}
        if protheus_data:
            kpis = AnalyticsEngine.process(intent, protheus_data)
            ctx['kpis'] = kpis
            
            if not ctx.get('tenant_system_prompt'):
                ctx['tenant_system_prompt'] = ""
            ctx['tenant_system_prompt'] += "\n\nREGRA CRITICA DE ANALYTICS: Você é um analista executivo. Use SOMENTE os indicadores fornecidos em 'kpis' no contexto. NUNCA recalcule totais. NUNCA estime percentuais. NUNCA derive métricas inexistentes. Se uma métrica for inconsistente ou marcada com erro, sinalize erro de dados. Baseie sua resposta APENAS nos KPIs calculados pelo backend."

        # Emitir o evento especial no inicio do stream contendo os KPIs para o Dashboard
        import json
        yield f"__META_KPIS__:{json.dumps(kpis)}\n"

        # 5. Generate Answer via stream generator
        full_answer = []
        from app.services.gemini_client import stream_gemini
        try:
            async for token in stream_gemini(
                question=question,
                protheus_data=protheus_data if protheus_data else None,
                intent=intent,
                context=ctx,
                history=history,
                image=payload.image,
            ):
                full_answer.append(token)
                yield token
        except asyncio.TimeoutError:
            error_message = "O serviço Gemini excedeu o tempo limite. A consulta não foi concluída."
            full_answer.append(error_message)
            yield error_message
        except Exception:
            error_message = "O serviço Gemini está temporariamente indisponível. A consulta não foi concluída."
            full_answer.append(error_message)
            yield error_message

        # 6. Audit Log após fim da geração
        answer = "".join(full_answer)
        elapsed_ms = int((time.time() - start_time) * 1000)
        try:
            self.audit.save({
                "tenant_id": tenant_id,
                "user_name": payload.user,
                "session_id": payload.session_id,
                "question": question,
                "answer": answer,
                "module": payload.module,
                "company": payload.company,
                "branch": payload.branch,
                "environment": payload.environment,
                "station": payload.station,
                "intent": intent,
                "confidence": 0.9,
                "response_time_ms": elapsed_ms,
                "data_volume": len(answer),
            })
        except Exception as e:
            print(f"Failed to save audit log: {e}")

