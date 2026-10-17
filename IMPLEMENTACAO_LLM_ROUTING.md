# Implementação proposta — roteamento de LLM

## Status

Este pacote é **aditivo**. Ele não altera `main.py`, autenticação, RBAC, rotas existentes,
banco ou migrations. A integração no endpoint real deve ocorrer somente após validar os
contratos e dependências atuais do backend.

## Política implementada

- `CORPORATE_RAG` e `NARRATIVE` → Phi-3.5 por API OpenAI-compatible/OpenVINO.
- `CODE_ASSIST` → Qwen2.5-Coder 3B por Ollama-Arc.
- `DETERMINISTIC` → bloqueado no roteador; deve usar engines do backend.

## Segurança

O request exige `tenant_id`, `user_id`, `trace_id` e `request_id`.
A implementação não registra prompt nem resposta nos logs comuns.
A origem desses identificadores deve ser a autenticação/contexto validado do backend,
nunca campos aceitos diretamente do frontend sem validação.

## Dependências

```bash
python -m pip install httpx pytest pytest-asyncio
```

## Validação

A partir da raiz `backend/`:

```bash
pytest tests/unit/test_model_router.py tests/unit/test_llm_providers.py
```

## Exemplo de uso interno

```python
from app.services.llm import AIWorkload, GenerationRequest, build_llm_service

service = build_llm_service()
result = await service.generate(
    GenerationRequest(
        prompt="Produza uma narrativa apenas com os fatos validados.",
        tenant_id=tenant_id,
        user_id=user_id,
        trace_id=trace_id,
        request_id=request_id,
        workload=AIWorkload.NARRATIVE,
        max_new_tokens=300,
    )
)
```

## Integração pendente

Antes de registrar uma rota pública:

1. Identificar a dependência real de autenticação/RBAC do backend.
2. Derivar tenant e usuário no servidor.
3. Confirmar o serviço de auditoria e o formato de erro com `traceId`.
4. Integrar o RAG tenant-scoped/pgvector antes de chamar `CORPORATE_RAG`.
5. Persistir provider, modelo, latência e fontes no `AnalysisContext`/auditoria.
6. Não expor seleção arbitrária de provider/modelo ao frontend.
