document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Calculador de Planos Dinâmicos (Toggle Mensal/Anual)
  const billingToggle = document.getElementById('billing-toggle');
  const priceProfessional = document.getElementById('price-professional');
  
  billingToggle.addEventListener('change', () => {
    if (billingToggle.checked) {
      // Preço anual com 20% de desconto (R$ 119/mês)
      priceProfessional.innerHTML = 'R$ 119<span>/mês</span>';
    } else {
      // Preço mensal cheio (R$ 149/mês)
      priceProfessional.innerHTML = 'R$ 149<span>/mês</span>';
    }
  });

  // 2. Simulador Interativo do Chat Copilot (com streaming simulado)
  const chatBody = document.getElementById('demo-chat-body');
  const chatInput = document.getElementById('demo-chat-input');
  const chatSend = document.getElementById('demo-chat-send');
  const themeToggle = document.getElementById('demo-theme-toggle');
  const widgetWrapper = document.querySelector('.demo-widget-wrapper');
  
  // Define o tema inicial do simulador como Dark para combinar com a landing page
  widgetWrapper.setAttribute('data-theme', 'dark');

  // Alternador de tema interno do widget
  themeToggle.addEventListener('click', () => {
    const currentTheme = widgetWrapper.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    widgetWrapper.setAttribute('data-theme', newTheme);
    themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
  });

  // Base de respostas pré-programadas para o simulador
  const answers = {
    "quem é a empresa padrão da conexão?": 
      "A empresa padrão configurada de forma segura na conexão do Copilot Protheus é a **RODOL Ltda (Código: 01)**, com a filial matriz **0101 (Matriz - Belo Horizonte)**. Esse isolamento garante que todas as consultas e relatórios criados sejam focados no tenant correto.",
    
    "quais as filiais cadastradas?": 
      "Atualmente, no banco do tenant RODOL Ltda (01), temos cadastrada:\n\n- **0101:** Matriz - BELO HORIZONTE\n\nCaso queira integrar ou cadastrar novas filiais na nuvem, você pode ajustar as configurações dinâmicas de conexão do Protheus.",
    
    "listar últimos pedidos da rodol ltda.": 
      "Fazendo consulta ao Protheus via API REST...\n\nÚltimos pedidos encontrados no banco PostgreSQL do tenant:\n\n1. **Pedido #00341:** Cliente *Elite Corp* • Valor: **R$ 12.430,00** • Status: Faturado.\n2. **Pedido #00342:** Cliente *Totvs Partner* • Valor: **R$ 8.920,00** • Status: Em aberto.\n3. **Pedido #00343:** Cliente *Rodol Importações* • Valor: **R$ 25.100,00** • Status: Processando pagamento.\n\nDeseja realizar alguma operação de análise em cima desses registros?"
  };

  const defaultFallback = 
    "Como este é o simulador de demonstração estática, as perguntas dinâmicas estão limitadas. Experimente clicar em um dos botões de sugestões acima para ver o poder do streaming SSE em tempo real, ou implante o plano Starter (gratuito) na sua máquina!";

  // Enviar mensagem
  function handleSendMessage(text) {
    const question = text.trim();
    if (!question) return;

    // Adiciona pergunta do usuário
    appendMessage('user', question);
    chatInput.value = '';

    // Adiciona balão temporário de carregamento da IA
    const assistantMsg = appendMessage('assistant', '...');

    // Simula tempo de resposta e depois realiza o streaming token-a-token
    setTimeout(() => {
      const normalizedQuery = question.toLowerCase().replace(/[?.!]/g, '').trim();
      const responseText = answers[normalizedQuery] || defaultFallback;
      simulateStreaming(assistantMsg, responseText);
    }, 800);
  }

  // Insere balão no chat
  function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `widget-msg ${role}`;
    msgDiv.innerHTML = `<p>${text}</p>`;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msgDiv;
  }

  // Simulação de streaming token-a-token (SSE)
  function simulateStreaming(element, text) {
    element.innerHTML = ''; // Limpa os três pontinhos
    
    // Splita por palavras para simular tokens reais
    const tokens = text.split(' ');
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < tokens.length) {
        // Trata formatações básicas de Markdown no simulador
        let currentText = tokens.slice(0, index + 1).join(' ');
        
        // Conversão de markdown básica para o simulador
        currentText = currentText
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br/>');
          
        element.innerHTML = `<p>${currentText}</p>`;
        chatBody.scrollTop = chatBody.scrollHeight;
        index++;
      } else {
        clearInterval(interval);
        // Adiciona thumbs feedback após a conclusão do streaming
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'msg-feedback';
        feedbackDiv.style.display = 'flex';
        feedbackDiv.style.gap = '6px';
        feedbackDiv.style.marginTop = '6px';
        feedbackDiv.style.justifyContent = 'flex-end';
        feedbackDiv.innerHTML = `
          <button class="feedback-btn" style="background:transparent;border:none;cursor:pointer;opacity:0.5;">👍</button>
          <button class="feedback-btn" style="background:transparent;border:none;cursor:pointer;opacity:0.5;">👎</button>
        `;
        
        // Adiciona ações aos botões de feedback mockados
        feedbackDiv.querySelectorAll('.feedback-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            btn.style.opacity = btn.style.opacity === '1' ? '0.5' : '1';
          });
        });
        
        element.appendChild(feedbackDiv);
      }
    }, 45); // ~20 tokens por segundo
  }

  // Handlers de Clique nos Botões de sugestão
  document.querySelectorAll('.suggest-btn').forEach(button => {
    button.addEventListener('click', () => {
      handleSendMessage(button.getAttribute('data-question'));
    });
  });

  // Handler de Clique no Enviar
  chatSend.addEventListener('click', () => {
    handleSendMessage(chatInput.value);
  });

  // Handler de Enter no Input
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage(chatInput.value);
    }
  });

});
