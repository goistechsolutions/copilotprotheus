from sqlalchemy.orm import Session
from app.services.ollama_client import ask_llm
from app.services.gemini_client import ask_gemini
from app.services.rag_service import RAGService
from app.crud.knowledge_crud import KnowledgeCRUD
from app.core.audit import AuditService
from app.core.config import settings
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

        # 2. Fetch Documentary Context from RAG
        rag_docs = self.rag.search(question, tenant_id=tenant_id, limit=3)
        doc_context = "\n".join([f"- {d['title']} (Página {d['page_number']}): {d['content']}" for d in rag_docs])
        
        # 3. Fetch Persistent Memory
        memories = self.crud.list_memories(tenant_id=tenant_id, limit=10)
        mem_context = "\n".join([f"- {m['memory_key']}: {m['memory_value']}" for m in memories])

        # 4. Augment Context
        ctx['document_context'] = doc_context
        ctx['memory_context'] = mem_context

        # 5. Generate Answer with Timeout (reduzido para 90s para evitar 504 do Cloudflare)
        timeout_sec = 90
        status_audit = "S"
        is_fallback_needed = False
        answer = ""
        
        try:
            llm_func = ask_gemini if settings.llm_backend == "gemini" else ask_llm
            answer = await asyncio.wait_for(
                llm_func(
                    question=question,
                    protheus_data=protheus_data if protheus_data else None,
                    intent=intent,
                    context=ctx,
                    history=history,
                    image=payload.image,
                ),
                timeout=timeout_sec
            )
            
            # Identify Gemini errors to trigger fallback
            if settings.llm_backend == "gemini" and ("Erro 503" in answer or "Erro na API do Gemini" in answer or "Erro de conexão" in answer):
                is_fallback_needed = True
                
        except (asyncio.TimeoutError, Exception) as e:
            if settings.llm_backend == "gemini":
                is_fallback_needed = True
            else:
                answer = "Tempo limite excedido." if isinstance(e, asyncio.TimeoutError) else f"Erro ao processar: {str(e)}"
                status_audit = "T" if isinstance(e, asyncio.TimeoutError) else "E"
                
        # AUTOMATIC FALLBACK TO OLLAMA (Gemma)
        if is_fallback_needed:
            print("Gemini unavailable or failed. Triggering local Ollama (Gemma 4) fallback...")
            try:
                answer = await asyncio.wait_for(
                    ask_llm(
                        question=question,
                        protheus_data=protheus_data if protheus_data else None,
                        intent=intent,
                        context=ctx,
                        history=history,
                        image=payload.image,
                    ),
                    timeout=timeout_sec
                )
            except Exception as e:
                answer = f"Erro no Fallback Local (Ollama): {str(e)}"
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
            "backend": os.getenv("LLM_BACKEND", "ollama"),
            "records_returned": records_returned,
            "response_time_ms": elapsed_ms,
            "status": status_audit
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

        # 5. Generate Answer via stream generator
        full_answer = []
        is_fallback_needed = False
        
        if settings.llm_backend == "gemini":
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
                    if "Erro 503" in token or "Erro na API do Gemini" in token or "Erro de conexão" in token:
                        is_fallback_needed = True
                        break
                    full_answer.append(token)
                    yield token
            except Exception:
                is_fallback_needed = True
        else:
            is_fallback_needed = True  # Triggers local branch directly

        # AUTOMATIC FALLBACK TO OLLAMA (Gemma)
        if is_fallback_needed:
            # Fallback only works smoothly in stream if it failed at the very beginning
            if settings.llm_backend == "gemini" and len(full_answer) == 0:
                print("Gemini unavailable in stream. Triggering local Ollama (Gemma 4) fallback...")
                from app.services.ollama_client import stream_llm
                try:
                    async for token in stream_llm(
                        question=question,
                        protheus_data=protheus_data if protheus_data else None,
                        intent=intent,
                        context=ctx,
                        history=history,
                        image=payload.image,
                    ):
                        full_answer.append(token)
                        yield token
                except Exception as e:
                    err_msg = f" Erro no Fallback Local (Ollama): {str(e)}"
                    full_answer.append(err_msg)
                    yield err_msg
            elif settings.llm_backend != "gemini":
                # Standard Ollama execution (not a fallback)
                from app.services.ollama_client import stream_llm
                try:
                    async for token in stream_llm(
                        question=question,
                        protheus_data=protheus_data if protheus_data else None,
                        intent=intent,
                        context=ctx,
                        history=history,
                        image=payload.image,
                    ):
                        full_answer.append(token)
                        yield token
                except Exception as e:
                    err_msg = f" Erro no Ollama: {str(e)}"
                    full_answer.append(err_msg)
                    yield err_msg

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

