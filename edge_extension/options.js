const form = document.getElementById("config-form");
const statusMessage = document.getElementById("statusMessage");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

const FIELDS = ["tenantId", "username", "password", "widgetUrl", "launchUrl"];

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

togglePassword.addEventListener("click", () => {
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
});

document.getElementById("testConnection").addEventListener("click", async () => {
  const launchUrl = document.getElementById("launchUrl").value.trim();
  if (!launchUrl) {
    showStatus("Informe a URL de Lançamento antes de testar.", true);
    return;
  }
  try {
    const response = await fetch(launchUrl, { method: "GET" });
    if (response.ok) {
      showStatus("Conexão bem-sucedida com o backend.");
    } else {
      showStatus(`Falha na conexão: HTTP ${response.status}`, true);
    }
  } catch (err) {
    showStatus("Não foi possível conectar. Verifique a URL e a rede.", true);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tenantId = document.getElementById("tenantId").value.trim();
  const widgetUrl = document.getElementById("widgetUrl").value.trim();
  const launchUrl = document.getElementById("launchUrl").value.trim();

  if (!tenantId || !widgetUrl || !launchUrl) {
    showStatus("Preencha os campos obrigatórios: Tenant ID, URL do Widget e URL de Lançamento.", true);
    return;
  }

  const config = {
    tenantId,
    username: document.getElementById("username").value.trim(),
    password: passwordInput.value,
    widgetUrl,
    launchUrl,
  };

  await chrome.storage.local.set(config);
  chrome.runtime.sendMessage({ type: "CONFIG_UPDATED", config });
  showStatus("Configurações salvas com sucesso.");
});

loadConfig();