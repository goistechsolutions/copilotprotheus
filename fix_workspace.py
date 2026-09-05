import re

path = 'frontend/src/pages/AgentWorkspace.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'normalizeAgentResult' not in content:
    content = content.replace('import StructuredResultPanel', "import { normalizeAgentResult } from '../utils/normalizeAgentResult';\nimport StructuredResultPanel")

# Replace logic in send
old_logic = '''      const hasExecutionError = ['failed', 'error', 'execution_failed'].includes(res.status);

      if (hasExecutionError) {
        setResult(null);
        setTask({ status: 'execution_failed', error: res.execution_error || res.error || res.summary || res.message || 'Falha na execução' });
      } else {
        setResult(res);
        setTask(res);
      }

      let replyMessage = 'Análise executiva concluída com sucesso no Protheus.';
      if (res.status === 'execution_failed') {
        replyMessage = `Erro na consulta Oracle: ${res.execution_error || 'Falha na execução.'}`;
      } else if (res.status === 'error') {
        replyMessage = `Consulta bloqueada: ${res.error || res.summary || res.message || 'Contexto não autorizado.'}`;
      } else if (res.summary) replyMessage = res.summary;
      else if (res.message) replyMessage = res.message;
      else if (res.answer) replyMessage = res.answer;

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: replyMessage,
          status: res.status,
          result: hasExecutionError ? null : res,
          userPrompt: text,
        },
      ]);'''

new_logic = '''      const normalized = normalizeAgentResult(res);

      if (normalized.status === 'error') {
        setResult(null);
        setTask({
          status: res.status || 'error',
          error: normalized.message,
          error_code: normalized.errorCode,
          correlation_id: normalized.correlationId,
        });
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            text: normalized.message,
            status: 'error',
            result: null,
            correlation_id: normalized.correlationId,
            userPrompt: text,
          },
        ]);
        return;
      }

      setResult(normalized.result);
      setTask(normalized.result);

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: normalized.message || 'Análise executiva concluída com sucesso no Protheus.',
          status: 'success',
          result: normalized.result,
          correlation_id: normalized.correlationId,
          userPrompt: text,
        },
      ]);'''

content = content.replace(old_logic, new_logic)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
