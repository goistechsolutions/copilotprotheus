import React, { useEffect, useMemo, useRef, useState } from "react";
import MarkdownText from "./components/MarkdownText";

const STORAGE_KEY = "copilot_protheus_chat_v2";
const DEFAULT_MIDDLEWARE = import.meta.env.VITE_MIDDLEWARE_URL || "";

function loadInitial(context) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  const intro = context?.module
    ? `Olá! Estou no módulo ${context.module}. Como posso ajudar?`
    : "Olá! Sou o assistente do Copilot Protheus. Como posso ajudar hoje?";
  return [{ role: "assistant", text: intro }];
}

export default function AssistantWidget({ embedded = false, compact = false, context = {} }) {
  const [open, setOpen] = useState(embedded ? true : false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState(() => loadInitial(context));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState(null);
  const [exporting, setExporting] = useState(false);
  
  // Configurações de Empresa e Filial do Protheus
  const [showSettings, setShowSettings] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(() => localStorage.getItem("active_company") || context.company || "01");
  const [activeBranch, setActiveBranch] = useState(() => localStorage.getItem("active_branch") || context.branch || "0101");

  const activeCompanyBranches = useMemo(() => {
    const comp = companies.find(c => c.code === activeCompany);
    return comp ? comp.branches || [] : [];
  }, [companies, activeCompany]);
  
  // Controle de Tema (Light por padrão)
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  
  // SaaS Companies & Licenciamento
  const [saasCompanies, setSaasCompanies] = useState([]);
  const [selectedSaasId, setSelectedSaasId] = useState("");
  const [saasFormMode, setSaasFormMode] = useState("edit");
  const [saasForm, setSaasForm] = useState({
    cnpj: "", ie: "", razao_social: "", email: "", telefone: "", endereco: "",
    protheus_grupo: "", protheus_empresa: "", protheus_unidade: "", protheus_filial: "",
    protheus_ambientes: "validacao", protheus_usuario: "",
    protheus_rest_url: "", protheus_webapp_url: "", licenca_uso: ""
  });
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseError, setLicenseError] = useState("");
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [sessionBlockMessage, setSessionBlockMessage] = useState("");


  
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const middlewareUrl = useMemo(() => DEFAULT_MIDDLEWARE, []);

  // CRUD SaaS Companies & Licenças
  async function loadSaasCompanies() {
    if (!token) return;
    try {
      const resp = await fetch(`${middlewareUrl}/api/companies`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setSaasCompanies(data);
        if (data.length > 0 && !selectedSaasId) {
          const activeTenantId = context.tenant_id || context.company || "01";
          const matched = data.find(c => c.protheus_grupo === activeTenantId);
          const selected = matched || data[0];
          setSelectedSaasId(selected.id.toString());
          setSaasForm(selected);
          setSaasFormMode("edit");
          
          if (selected.protheus_empresa) {
            setActiveCompany(selected.protheus_empresa);
            localStorage.setItem("active_company", selected.protheus_empresa);
          }
          if (selected.protheus_filial) {
            setActiveBranch(selected.protheus_filial);
            localStorage.setItem("active_branch", selected.protheus_filial);
          }
        }
      }
    } catch (e) {
      console.error("Falha ao carregar empresas SaaS:", e);
    }
  }

  async function verifySaaSLicense(licToken, cnpj) {
    if (!licToken || !cnpj) {
      setLicenseInfo(null);
      setLicenseError("Sem licença cadastrada.");
      return;
    }
    try {
      const resp = await fetch(`${middlewareUrl}/api/license/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ token: licToken, cnpj })
      });
      if (resp.ok) {
        const info = await resp.json();
        if (info.valid) {
          setLicenseInfo(info);
          setLicenseError("");
        } else {
          setLicenseInfo(null);
          setLicenseError(info.error || "Licença inválida.");
        }
      }
    } catch (e) {
      setLicenseInfo(null);
      setLicenseError("Erro ao verificar licença.");
    }
  }

  async function initAuthentication() {
    const userVal = context.user || "pilot";
    const tenantIdVal = context.tenant_id || context.company || "01";
    
    try {
      const tResp = await fetch(`${middlewareUrl}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user: userVal, 
          module: context.module || null,
          tenant_id: tenantIdVal
        })
      });
      
      if (!tResp.ok) {
        throw new Error("Falha ao obter token de acesso.");
      }
      
      const tData = await tResp.json();
      const currentToken = tData.token;
      setToken(currentToken);
      localStorage.setItem("token", currentToken);
      
      const vResp = await fetch(`${middlewareUrl}/api/auth/validate-session`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          tenant_id: tenantIdVal,
          user: userVal
        })
      });
      
      if (vResp.ok) {
        setSessionBlocked(false);
        setSessionBlockMessage("");
      } else {
        const errData = await vResp.json();
        let errMsg = errData.detail || "Licença inválida ou usuário não autorizado.";
        if (!context.tenant_id && tenantIdVal === "01") {
           errMsg = "Extensão não configurada! Clique no ícone do Copilot na barra superior do seu navegador e preencha o 'Grupo/Tenant ID' (ex: rodol_prd). Depois, dê um F5 na página.";
        }
        setSessionBlocked(true);
        setSessionBlockMessage(errMsg);
      }
    } catch (e) {
      setSessionBlocked(true);
      let errMsg = e.message || "Erro de conexão ao validar licença.";
      if (!context.tenant_id && tenantIdVal === "01") {
         errMsg = "Extensão não configurada! Clique no ícone do Copilot na barra do seu navegador e preencha o 'Grupo/Tenant ID' (ex: rodol_prd). Depois, dê F5 na página.";
      }
      setSessionBlockMessage(errMsg);
      setToken("");
      localStorage.removeItem("token");
    }
  }

  async function saveSaasCompany() {
    if (!token) return;
    try {
      const isEdit = saasFormMode === "edit";
      const url = isEdit 
        ? `${middlewareUrl}/api/companies/${saasForm.id}`
        : `${middlewareUrl}/api/companies`;
      const method = isEdit ? "PUT" : "POST";
      
      const resp = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(saasForm)
      });
      
      if (resp.ok) {
        const saved = await resp.json();
        await loadSaasCompanies();
        setSelectedSaasId(saved.id.toString());
        
        if (saasForm.protheus_empresa) {
          setActiveCompany(saasForm.protheus_empresa);
          localStorage.setItem("active_company", saasForm.protheus_empresa);
        }
        if (saasForm.protheus_filial) {
          setActiveBranch(saasForm.protheus_filial);
          localStorage.setItem("active_branch", saasForm.protheus_filial);
        }
        
        await initAuthentication();
        alert("Configurações da empresa salvas com sucesso!");
      } else {
        const errData = await resp.json();
        alert(`Erro ao salvar: ${errData.detail || "Erro desconhecido"}`);
      }
    } catch (e) {
      alert(`Erro de conexão: ${e.message}`);
    }
  }



  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open, minimized, maximized]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (token && showSettings) {
      loadSaasCompanies();
    }
  }, [token, showSettings]);

  useEffect(() => {
    if (selectedSaasId && selectedSaasId !== "new") {
      const found = saasCompanies.find(c => c.id.toString() === selectedSaasId);
      if (found) {
        setSaasForm(found);
        setSaasFormMode("edit");
        verifySaaSLicense(found.licenca_uso, found.cnpj);
      }
    } else if (selectedSaasId === "new") {
      setSaasForm({
        cnpj: "", ie: "", razao_social: "", email: "", telefone: "", endereco: "",
        protheus_grupo: "", protheus_empresa: "", protheus_unidade: "", protheus_filial: "",
        protheus_ambientes: "validacao", protheus_usuario: "",
        protheus_rest_url: "", protheus_webapp_url: "", licenca_uso: ""
      });
      setSaasFormMode("create");
      setLicenseInfo(null);
      setLicenseError("");
    }
  }, [selectedSaasId, saasCompanies]);
  
  // Sincroniza o tema do DOM com o estado local
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Autentica e valida sessão/licença no mount
  useEffect(() => {
    initAuthentication();
  }, [middlewareUrl]);

  // Carrega empresas do Protheus quando o token está disponível
  useEffect(() => {
    async function loadCompanies() {
      if (!token) return;
      try {
        const resp = await fetch(`${middlewareUrl}/protheus/companies`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          // Aceita formato de objeto { companies: [...] } ou array direto
          if (data && Array.isArray(data.companies)) {
            setCompanies(data.companies);
          } else if (Array.isArray(data)) {
            setCompanies(data);
          }
        }
      } catch (e) {
        console.error("Falha ao carregar empresas do Protheus:", e);
      }
    }
    loadCompanies();
  }, [token, middlewareUrl]);

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'cprot-resize', open, minimized, maximized }, '*');
    }
  }, [open, minimized, maximized]);

  async function requestScreenData() {
    return new Promise((resolve) => {
      if (window.parent === window) return resolve('');
      
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve('');
      }, 300);

      const handler = (e) => {
        if (e.data && e.data.type === 'cprot-screen-data') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(e.data.text || '');
        }
      };
      
      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'cprot-request-screen' }, '*');
    });
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || sessionBlocked) return;
    setError("");
    const historyToSend = [...messages];
    setMessages(prev => [...prev, { role: "user", text }, { role: "assistant", text: "..." }]);
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const endpoint = `${middlewareUrl}/chat/stream`;

    try {
      let currentToken = token;
      if (!currentToken) {
        const tResp = await fetch(`${middlewareUrl}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: context.user || "pilot", module: context.module || null })
        });
        if (tResp.ok) {
          const tData = await tResp.json();
          currentToken = tData.token;
          setToken(currentToken);
        }
      }

      const screenText = await requestScreenData();
      const enrichedContext = { ...context, screen_text: screenText };

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {})
        },
        body: JSON.stringify({
          question: text,
          module: context.module || null,
          user: context.user || "pilot",
          password: context.password || null,
          protheus_token: context.protheus_token || null,
          session_id: context.session_id || `web-${Date.now()}`,
          company: activeCompany,
          branch: activeBranch,
          environment: context.environment || null,
          station: context.station || null,
          history: historyToSend,
          context: {
            ...enrichedContext,
            company: activeCompany,
            branch: activeBranch,
            password: context.password || null,
            protheus_token: context.protheus_token || null
          },
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const raw = await resp.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch {}
        const detail = data?.detail || data?.message || raw || `HTTP ${resp.status}`;
        throw new Error(`${detail} | endpoint=${endpoint}`);
      }

      // Lógica de Leitura da Stream SSE
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answerAccumulator = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Mantém o restante da linha incompleta no buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          
          const rawData = trimmed.substring(6);
          if (rawData === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(rawData);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.token) {
              answerAccumulator += parsed.token;
              
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "assistant",
                  text: answerAccumulator,
                };
                return next;
              });
            }
          } catch (e) {
            console.error("Falha ao parsear chunk:", e);
          }
        }
      }

      // Garante que o estado final não termine com três pontinhos se a stream encerrou vazia
      setMessages(prev => {
        const next = [...prev];
        const lastMsg = next[next.length - 1];
        if (lastMsg && lastMsg.text === "...") {
          lastMsg.text = "Sem resposta no momento.";
        }
        return next;
      });

    } catch (e) {
      if (e.name !== "AbortError") {
        const msg = `Falha ao conectar no backend: ${e.message || 'erro desconhecido'} | endpoint=${endpoint}`;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: msg };
          return next;
        });
        setError(msg);
      } else {
        // Abort foi intencional (usuário clicou Parar)
        setMessages(prev => {
          const next = [...prev];
          const lastMsg = next[next.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            if (lastMsg.text === '...') {
              lastMsg.text = '⏹ Geração interrompida pelo usuário.';
            } else {
              lastMsg.text += '\n\n⏹ _Geração interrompida._';
            }
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function stopGeneration() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  function messageHasTable(text) {
    if (!text) return false;
    const lines = text.split("\n");
    let pipeCount = 0;
    for (const line of lines) {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        pipeCount++;
      }
    }
    return pipeCount >= 2;
  }

  function getActiveReportType() {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && messageHasTable(lastMsg.text)) {
      return "markdown_export";
    }

    const mod = (context.module || '').toUpperCase();
    if (mod === 'SIGAFAT') return 'pedidos_abertos';
    if (mod === 'SIGAEST') return 'saldo_produtos';
    if (mod === 'SIGAFIS') return 'nfs_emitidas';
    if (mod === 'SIGACTB') return 'lancamentos';
    if (mod === 'SIGACOM') return 'pedidos_abertos';
    return null;
  }

  async function exportReport(format, customMarkdown = null) {
    const reportType = getActiveReportType();
    if (exporting) return;
    
    setExporting(true);
    setError("");

    try {
      let currentToken = token;
      if (!currentToken) {
        const tResp = await fetch(`${middlewareUrl}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: context.user || "pilot", module: context.module || null })
        });
        if (tResp.ok) {
          const tData = await tResp.json();
          currentToken = tData.token;
          setToken(currentToken);
        }
      }

      let url = `${middlewareUrl}/report/generate`;
      let bodyData = {
        report_type: reportType,
        filters: { cFilial: activeBranch },
        format: format
      };

      if (customMarkdown || reportType === "markdown_export") {
        url = `${middlewareUrl}/report/export-markdown`;
        bodyData = {
          markdown: customMarkdown || (messages[messages.length - 1]?.text || ""),
          format: format,
          title: "Resultados Copilot"
        };
      }

      const genResp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {})
        },
        body: JSON.stringify(bodyData)
      });

      if (!genResp.ok) {
        throw new Error(`Erro na geração: HTTP ${genResp.status}`);
      }

      const genData = await genResp.json();
      const filename = genData.filename;

      // Download autenticado do arquivo gerado
      const dlResp = await fetch(`${middlewareUrl}/report/download/${filename}`, {
        headers: {
          ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {})
        }
      });

      if (!dlResp.ok) {
        throw new Error(`Erro no download: HTTP ${dlResp.status}`);
      }

      const blob = await dlResp.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);

    } catch (e) {
      console.error("Erro ao exportar:", e);
      setError(`Falha ao exportar relatório: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  function handleFeedback(index, type) {
    setMessages(prev => {
      const next = [...prev];
      if (next[index].feedback === type) {
        delete next[index].feedback;
      } else {
        next[index].feedback = type;
      }
      return next;
    });
  }

  function clearHistory() {
    setMessages([loadInitial(context)[0]]);
    localStorage.removeItem(STORAGE_KEY);
  }

  const headerContext = [context.environment, activeCompany, activeBranch, context.module].filter(Boolean).join(" • ");
  const shouldShowPanel = open && !minimized;

  return (
    <div className={`assistant-shell ${compact ? 'compact' : ''} ${open ? 'open' : 'closed'} ${minimized ? 'minimized' : ''} ${maximized ? 'maximized' : ''}`}>
      {!open && (
        <button className="assistant-launcher" onClick={() => setOpen(true)} aria-label="Abrir chat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', overflow: 'hidden' }}>
          <img src="/logo_elitecorp.png" alt="Elitecorp Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </button>
      )}
      {open && (
        <div className={`assistant-panel ${shouldShowPanel ? 'expanded' : 'collapsed'}`}>
          <div className="assistant-header">
            <div>
              <strong>Copilot Protheus</strong>
              {headerContext ? <div className="assistant-meta">{headerContext}</div> : null}
            </div>
            <div className="assistant-actions">
              {/* Botão de Configurações */}
              <button 
                onClick={() => setShowSettings(s => !s)} 
                aria-label="Configurações do Agente"
                className={showSettings ? "active" : ""}
              >
                ⚙️
              </button>
              {/* Botão de Toggle de Tema */}
              <button 
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} 
                aria-label="Alternar tema"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button onClick={() => setMinimized(v => !v)} aria-label="Minimizar ou expandir">{minimized ? '↗' : '–'}</button>
              <button onClick={() => { setMaximized(v => !v); setMinimized(false); }} aria-label="Maximizar ou restaurar">{maximized ? '⊡' : '⤢'}</button>
              <button onClick={() => { setOpen(false); setMinimized(false); setMaximized(false); setShowSettings(false); }} aria-label="Fechar chat">✕</button>
            </div>
          </div>
          {shouldShowPanel && (
            <>
              {showSettings ? (
                <div className="settings-panel scrollable-settings">
                    <div className="tab-content">
                      <div className="setting-row">
                        <label>Empresa Ativa (SaaS):</label>
                        <select 
                          value={selectedSaasId} 
                          onChange={e => setSelectedSaasId(e.target.value)}
                        >
                          {saasCompanies.map(c => (
                            <option key={c.id} value={c.id.toString()}>
                              {c.id} - {c.razao_social} ({c.cnpj})
                            </option>
                          ))}
                          <option value="new">+ Cadastrar Nova Empresa</option>
                        </select>
                      </div>

                      <div className="settings-divider">Dados Cadastrais</div>

                      <div className="setting-row">
                        <label>Razão Social:</label>
                        <input 
                          value={saasForm.razao_social} 
                          onChange={e => setSaasForm({...saasForm, razao_social: e.target.value})} 
                          placeholder="Elitecorp SA" 
                        />
                      </div>

                      <div className="setting-row-group two-cols">
                        <div className="setting-row">
                          <label>CNPJ:</label>
                          <input 
                            value={saasForm.cnpj} 
                            onChange={e => setSaasForm({...saasForm, cnpj: e.target.value})} 
                            placeholder="Apenas números" 
                          />
                        </div>
                        <div className="setting-row">
                          <label>Inscrição Estadual:</label>
                          <input 
                            value={saasForm.ie || ""} 
                            onChange={e => setSaasForm({...saasForm, ie: e.target.value})} 
                            placeholder="IE da empresa" 
                          />
                        </div>
                      </div>

                      <div className="setting-row-group two-cols">
                        <div className="setting-row">
                          <label>E-mail:</label>
                          <input 
                            value={saasForm.email || ""} 
                            onChange={e => setSaasForm({...saasForm, email: e.target.value})} 
                            placeholder="financeiro@empresa.com" 
                          />
                        </div>
                        <div className="setting-row">
                          <label>Telefone:</label>
                          <input 
                            value={saasForm.telefone || ""} 
                            onChange={e => setSaasForm({...saasForm, telefone: e.target.value})} 
                            placeholder="(11) 99999-9999" 
                          />
                        </div>
                      </div>

                      <div className="setting-row">
                        <label>Endereço Completo:</label>
                        <input 
                          value={saasForm.endereco || ""} 
                          onChange={e => setSaasForm({...saasForm, endereco: e.target.value})} 
                          placeholder="Av. Paulista, 1000, SP" 
                        />
                      </div>

                      <div className="settings-divider">Parâmetros TOTVS Protheus</div>

                      <div className="setting-row-group two-cols">
                        <div className="setting-row">
                          <label>Grupo de Empresa (Obrigatório):</label>
                          <input 
                            value={saasForm.protheus_grupo} 
                            onChange={e => setSaasForm({...saasForm, protheus_grupo: e.target.value})} 
                            placeholder="Ex: pilot_rodolltda" 
                          />
                        </div>
                        <div className="setting-row">
                          <label>Código da Empresa (Opcional):</label>
                          <input 
                            value={saasForm.protheus_empresa || ""} 
                            onChange={e => setSaasForm({...saasForm, protheus_empresa: e.target.value})} 
                            placeholder="Ex: 01" 
                          />
                        </div>
                      </div>

                      <div className="setting-row-group two-cols">
                        <div className="setting-row">
                          <label>Unidade de Negócio (Opcional):</label>
                          <input 
                            value={saasForm.protheus_unidade || ""} 
                            onChange={e => setSaasForm({...saasForm, protheus_unidade: e.target.value})} 
                            placeholder="Ex: 0001" 
                          />
                        </div>
                        <div className="setting-row">
                          <label>Filial (Obrigatório):</label>
                          <input 
                            value={saasForm.protheus_filial} 
                            onChange={e => setSaasForm({...saasForm, protheus_filial: e.target.value})} 
                            placeholder="Ex: 0101" 
                          />
                        </div>
                      </div>

                      <div className="setting-row-group two-cols">
                        <div className="setting-row">
                          <label>Ambientes (Obrigatório):</label>
                          <input 
                            value={saasForm.protheus_ambientes} 
                            onChange={e => setSaasForm({...saasForm, protheus_ambientes: e.target.value})} 
                            placeholder="Ex: validacao,producao" 
                          />
                        </div>
                        <div className="setting-row">
                          <label>Usuário Protheus:</label>
                          <input 
                            value={saasForm.protheus_usuario || ""} 
                            onChange={e => setSaasForm({...saasForm, protheus_usuario: e.target.value})} 
                            placeholder="Ex: admin" 
                          />
                        </div>
                      </div>

                      <div className="setting-row">
                        <label>URL Portal REST Protheus:</label>
                        <input 
                          value={saasForm.protheus_rest_url || ""} 
                          onChange={e => setSaasForm({...saasForm, protheus_rest_url: e.target.value})} 
                          placeholder="Ex: https://empresa.protheus.cloudtotvs.com.br:10707/rest" 
                        />
                      </div>

                      <div className="setting-row">
                        <label>URL WebApp/WebClient Protheus:</label>
                        <input 
                          value={saasForm.protheus_webapp_url || ""} 
                          onChange={e => setSaasForm({...saasForm, protheus_webapp_url: e.target.value})} 
                          placeholder="Ex: https://empresa.protheus.cloudtotvs.com.br:10703/webapp/index.html" 
                        />
                      </div>

                      <div className="settings-divider">Licença de Uso</div>
                      <div className="setting-row">
                        <label>Licença JWT:</label>
                        <textarea 
                          className="license-textarea"
                          value={saasForm.licenca_uso || ""} 
                          onChange={e => setSaasForm({...saasForm, licenca_uso: e.target.value})} 
                          placeholder="Cole a chave de licença aqui" 
                        />
                      </div>

                      {/* Status da Licença */}
                      <div className="license-status-display">
                        {licenseInfo ? (
                          <div className="license-badge valid">
                            ✅ Licença Ativa (Plano: {licenseInfo.plan_level.toUpperCase()})<br/>
                            <span>Expira em: {licenseInfo.expiration_date_formatted}</span>
                          </div>
                        ) : (
                          <div className="license-badge invalid">
                            ❌ {licenseError || "Licença Inválida ou Vencida"}
                          </div>
                        )}
                      </div>

                      <button className="settings-save-btn" onClick={saveSaasCompany}>
                        💾 Salvar Empresa
                      </button>
                    </div>

                  <button className="settings-save-btn" style={{ background: '#475569', marginTop: '10px' }} onClick={() => setShowSettings(false)}>
                    Confirmar e Sair
                  </button>
                </div>
              ) : sessionBlocked ? (
                <div className="blocked-panel">
                  <div className="blocked-content">
                    <span className="blocked-icon">🔒</span>
                    <h3>Acesso Bloqueado</h3>
                    <p>{sessionBlockMessage || "Licença inválida ou usuário não autorizado."}</p>
                    <button className="blocked-retry-btn" onClick={initAuthentication}>Tentar Novamente</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="assistant-body">
                {messages.map((m, i) => (
                  <div key={i} className={`msg ${m.role}`}>
                    {m.role === 'assistant' ? (
                      <>
                        <MarkdownText text={m.text} />
                        {m.text !== '...' && messageHasTable(m.text) && (
                          <div className="report-toolbar-inline">
                            <span>Exportar tabela:</span>
                            <button onClick={() => exportReport('xlsx', m.text)} disabled={exporting}>
                              📊 Excel
                            </button>
                            <button onClick={() => exportReport('pdf', m.text)} disabled={exporting}>
                              📄 PDF
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      m.text
                    )}
                    
                    {/* Botões de Feedback Thumbs */}
                    {m.role === 'assistant' && m.text !== '...' && i > 0 && (
                      <div className="msg-feedback">
                        <button 
                          className={`feedback-btn ${m.feedback === 'up' ? 'active' : ''}`}
                          onClick={() => handleFeedback(i, 'up')}
                        >
                          👍
                        </button>
                        <button 
                          className={`feedback-btn ${m.feedback === 'down' ? 'active' : ''}`}
                          onClick={() => handleFeedback(i, 'down')}
                        >
                          👎
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              
              {getActiveReportType() && (
                <div className="report-toolbar">
                  <span>Exportar:</span>
                  <button onClick={() => exportReport('xlsx')} disabled={exporting || loading}>
                    📊 Excel
                  </button>
                  <button onClick={() => exportReport('pdf')} disabled={exporting || loading}>
                    📄 PDF
                  </button>
                  {exporting && <span className="exporting-lbl">Gerando...</span>}
                </div>
              )}

              <div className="assistant-footer">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()} placeholder="Digite sua pergunta" disabled={loading} />
                {loading ? (
                  <button className="stop-btn" onClick={stopGeneration} aria-label="Parar geração">⏹ Parar</button>
                ) : (
                  <button onClick={sendMessage}>Enviar</button>
                )}
                <button onClick={clearHistory} disabled={loading}>Limpar</button>
              </div>
              {error ? <div className="assistant-error">{error}</div> : null}
            </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

