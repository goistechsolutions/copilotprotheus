(function () {
  const AGENT_URL = "https://SEU-DOMINIO.pages.dev";

  const fab = document.createElement("div");
  fab.id = "copilot-fab";
  fab.innerHTML = `<img src="${chrome.runtime.getURL("icons/icon-48.png")}" alt="Assistente">`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "copilot-panel";
  panel.style.display = "none";
  panel.innerHTML = `
    <div id="copilot-panel-header">
      <span>Copilot Protheus</span>
      <button id="copilot-close">✕</button>
    </div>
    <iframe id="copilot-iframe" src="${AGENT_URL}"></iframe>
  `;
  document.body.appendChild(panel);

  fab.addEventListener("click", () => {
    panel.style.display = "flex";
    fab.style.display = "none";
  });

  panel.querySelector("#copilot-close").addEventListener("click", () => {
    panel.style.display = "none";
    fab.style.display = "flex";
  });
})();
