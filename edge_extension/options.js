const form = document.getElementById("config-form");
const statusMessage = document.getElementById("statusMessage");

const FIELDS = ["tenantId", "environmentCode", "widgetUrl", "launchUrl"];

async function loadConfig() {
  const data = await chrome.storage.local.get(FIELDS);
  FIELDS.forEach((field) => {
    const el = document.getElementById(field);
    if (el && data[field]) el.value = data[field];
  });
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = isError ? "status error" : "status success";
  setTimeout(() => { statusMessage.textContent = ""; }, 4000);
}

document.getElementById("testConnection").addEventListener("click", async () => {
  const launchUrl = document.getElementById("launchUrl").value.trim();
  if (!launchUrl) {
    showStatus("Informe a URL de Lançamento antes de testar.", true);
    return;
  }
  try {
    const response = await fetch(launchUrl, { method: "GET" });
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      showStatus("URL de lançamento acessível.");
    } else {
      showStatus(`Falha na URL de lançamento: HTTP ${response.status}`, true);
    }
  } catch (err) {
    showStatus("Não foi possível acessar a URL. Verifique a rede e as permissões do host.", true);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tenantId = document.getElementById("tenantId").value.trim();
  const environmentCode = document.getElementById("environmentCode").value.trim();
  const widgetUrl = document.getElementById("widgetUrl").value.trim();
  const launchUrl = document.getElementById("launchUrl").value.trim();

  if (!tenantId || !environmentCode || !widgetUrl || !launchUrl) {
    showStatus("Preencha Tenant ID, environment code, URL do Widget e URL de Lançamento.", true);
    return;
  }

  let widgetOrigin;
  try {
    widgetOrigin = new URL(widgetUrl).origin;
  } catch {
    showStatus("URL do Widget inválida.", true);
    return;
  }

  const config = { tenantId, environmentCode, widgetUrl, launchUrl, widgetOrigin };
  await chrome.storage.local.set(config);
  chrome.runtime.sendMessage({ type: "CONFIG_UPDATED", config });
  showStatus("Configurações salvas com sucesso.");
});

loadConfig();
