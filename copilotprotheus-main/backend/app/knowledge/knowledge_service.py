from app.knowledge.processos import PROCESSES
from app.knowledge.tabelas import TABLES
from app.knowledge.doubts_compras import DOUBTS as COMPRA_DOUBTS
from app.knowledge.doubts_vendas import DOUBTS as VENDAS_DOUBTS
from app.knowledge.doubts_estoque import DOUBTS as ESTOQUE_DOUBTS
from app.knowledge.doubts_financeiro import DOUBTS as FIN_DOUBTS

MODULE_DOUBTS = {
    'compras': COMPRA_DOUBTS,
    'vendas': VENDAS_DOUBTS,
    'estoque': ESTOQUE_DOUBTS,
    'financeiro': FIN_DOUBTS,
}

def get_knowledge(module: str | None, question: str):
    module = (module or '').lower()
    result = {
        'module': module,
        'processes': PROCESSES.get(module, []),
        'tables': TABLES,
        'answer': None,
        'source': 'knowledge_base'
    }
    for item in MODULE_DOUBTS.get(module, []):
        if any(token.lower() in question.lower() for token in item['question'].split() if len(token) > 3):
            result['answer'] = item['answer']
            return result
    if module in PROCESSES:
        result['answer'] = f"Para o módulo {module}, o fluxo principal envolve: " + '; '.join(PROCESSES[module])
    else:
        result['answer'] = 'Base de conhecimento não específica para esta pergunta. Use módulo ou detalhe melhor a solicitação.'
    return result
