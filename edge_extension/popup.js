const defaultLaunchUrl = 'https://copilot.elitecorp.tec.br/api/launch';
const defaultWidgetUrl = 'https://copilot.elitecorp.tec.br/';
const defaultTenantId = '';

// Carrega os valores salvos no storage
chrome.storage.local.get(['launch_url', 'widget_url', 'tenant_id', 'agent_user', 'agent_password'], function (result) {
  document.getElementById('launch-url').value = result.launch_url || defaultLaunchUrl;
  document.getElementById('widget-url').value = result.widget_url || defaultWidgetUrl;
  document.getElementById('tenant-id').value = result.tenant_id || defaultTenantId;
  document.getElementById('agent-user').value = result.agent_user || '';
  document.getElementById('agent-password').value = result.agent_password || '';
});

// Salva os valores no storage
document.getElementById('save').addEventListener('click', function () {
  const launchUrl = document.getElementById('launch-url').value.trim() || defaultLaunchUrl;
  const widgetUrl = document.getElementById('widget-url').value.trim() || defaultWidgetUrl;
  const tenantId = document.getElementById('tenant-id').value.trim() || defaultTenantId;
  const agentUser = document.getElementById('agent-user').value.trim();
  const agentPassword = document.getElementById('agent-password').value.trim();
  
  chrome.storage.local.set({ 
    launch_url: launchUrl, 
    widget_url: widgetUrl, 
    tenant_id: tenantId,
    agent_user: agentUser,
    agent_password: agentPassword
  }, function () {
    const btn = document.getElementById('save');
    btn.textContent = 'Salvo com Sucesso!';
    setTimeout(() => { btn.textContent = 'Salvar Configurações'; }, 1500);
  });
});

document.getElementById('open').addEventListener('click', function () {
  chrome.storage.local.get(['launch_url'], function (result) {
    const url = result.launch_url || defaultLaunchUrl;
    chrome.tabs.create({ url });
  });
});

document.getElementById('toggle').addEventListener('click', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: function () {
        const frame = document.getElementById('cprot-widget-frame');
        if (frame) frame.style.display = frame.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
});

