const FIELDS = ["tenantId", "username", "password", "widgetUrl", "launchUrl"];

async function loadConfig() {
  const data = await chrome.storage.local.get(FIELDS);
  FIELDS.forEach((field) => {
    const el = document.getElementById(field);
    if (el && data[field]) el.value = data[field];
  });
}

function showStatus(message, isError = false) {
  const statusEl = document.getElementById("statusMessage");
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status success";
  setTimeout(() => { statusEl.textContent = ""; }, 3000);
}

document.getElementById("openProtheusBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_PROTHEUS" });
});

document.getElementById("toggleWidgetBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TOGGLE_WIDGET_FROM_POPUP" });
});

document.getElementById("openOptionsLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("saveConfigBtn").addEventListener("click", async () => {
  const tenantId = document.getElementById("tenantId").value.trim();
  const widgetUrl = document.getElementById("widgetUrl").value.trim();
  const launchUrl = document.getElementById("launchUrl").value.trim();

  if (!tenantId || !widgetUrl || !launchUrl) {
    showStatus("Preencha Tenant ID, URL do Widget e URL de Lançamento.", true);
    return;
  }

  const config = {
    tenantId,
    username: document.getElementById("username").value.trim(),
    password: document.getElementById("password").value,
    widgetUrl,
    launchUrl,
  };

  await chrome.storage.local.set(config);
  chrome.runtime.sendMessage({ type: "CONFIG_UPDATED", config });
  showStatus("Configurações salvas com sucesso.");
});

loadConfig();