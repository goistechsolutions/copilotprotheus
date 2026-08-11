(function () {
  if (document.getElementById("copilot-fab")) return;

  const fab = document.createElement("div");
  fab.id = "copilot-fab";
  fab.innerHTML = `<span>✦</span>`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "copilot-panel";
  panel.style.display = "none";
  panel.innerHTML = `
    <div id="copilot-panel-header">
      <span>Copilot Protheus</span>
      <button id="copilot-close" type="button">✕</button>
    </div>
    <iframe id="copilot-iframe" src=""></iframe>
  `;
  document.body.appendChild(panel);

  function applyConfig(config) {
    const iframe = document.getElementById("copilot-iframe");
    if (iframe && config?.widgetUrl) {
      iframe.src = `${config.widgetUrl}?tenant=${encodeURIComponent(config.tenantId || "")}`;
    }
  }

  chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (config) => {
    applyConfig(config);
  });

  fab.addEventListener("click", () => {
    panel.style.display = "flex";
    fab.style.display = "none";
  });

  panel.querySelector("#copilot-close").addEventListener("click", () => {
    panel.style.display = "none";
    fab.style.display = "flex";
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_WIDGET") {
      const isOpen = panel.style.display === "flex";
      panel.style.display = isOpen ? "none" : "flex";
      fab.style.display = isOpen ? "flex" : "none";
    }

    if (message.type === "RELOAD_WIDGET") {
      applyConfig(message.config);
    }
  });
})();