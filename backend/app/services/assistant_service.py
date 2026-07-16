from sqlalchemy.orm import Session
from app.services.ollama_client import ask_llm
from app.services.gemini_client import ask_gemini
from app.services.rag_service import RAGService
from app.crud.knowledge_crud import KnowledgeCRUD
from app.core.audit import AuditService
from app.core.config import settings
import os, time, asyncio

class AssistantService:
    def __init__(self, db: Session):
        self.db = db
        self.rag = RAGService(db)
        self.crud = KnowledgeCRUD(db)
        self.audit = AuditService(db)

    async def answer_question(self, payload, ctx: dict) -> dict:
        start_time = time.time()
        question      = payload.question
        intent        = payload.intent or "geral"
        protheus_data = payload.protheus_data or {}
        history       = payload.history or []

        # 1. Obter o tenant_id (obrigatório para SaaS)
        tenant_id = ctx.get("tenant_id") or "default"

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
        except asyncio.TimeoutError:
            answer = "Tempo limite excedido ao processar a resposta do LLM (Timeout)."
            status_audit = "T"
        except Exception as e:
            answer = f"Erro ao processar: {str(e)}"
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
        if settings.llm_backend == "gemini":
            from app.services.gemini_client import stream_gemini
            llm_stream = stream_gemini
        else:
            from app.services.ollama_client import stream_llm
            llm_stream = stream_llm
        
        full_answer = []
        async for token in llm_stream(
            question=question,
            protheus_data=protheus_data if protheus_data else None,
            intent=intent,
            context=ctx,
            history=history,
            image=payload.image,
        ):
            full_answer.append(token)
            yield token

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

