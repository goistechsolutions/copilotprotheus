chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture_screen") {
    // Tenta capturar a aba visível
    chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("Erro ao capturar tela:", chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    // Retornar true indica que a resposta será assíncrona
    return true; 
  } else if (request.action === "cprot_api_fetch") {
    fetch(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body
    })
    .then(async res => {
      const text = await res.text();
      sendResponse({ ok: res.ok, status: res.status, text: text });
    })
    .catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
});
