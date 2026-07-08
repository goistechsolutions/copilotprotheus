import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

const DEFAULT_MIDDLEWARE = window.location.origin;

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('admin_key') || '');
  
  // Data States
  const [companies, setCompanies] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [audits, setAudits] = useState([]);
  const [memories, setMemories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState({ status: 'checking', database: 'checking' });

  // Company Modal State
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyModalMode, setCompanyModalMode] = useState('add');
  const [companyForm, setCompanyForm] = useState({
    cnpj: '', ie: '', razao_social: '', email: '', telefone: '', endereco: '',
    protheus_grupo: '', protheus_empresa: '', protheus_unidade: '', protheus_filial: '',
    protheus_ambientes: 'validacao', protheus_usuario: '',
    protheus_rest_url: '', protheus_webapp_url: '', licenca_uso: ''
  });

  // Tenant Modal State
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantModalMode, setTenantModalMode] = useState('add');
  const [tenantForm, setTenantForm] = useState({
    id: '', name: '', protheus_rest_url: '', protheus_user: '', protheus_password: '', auth_mode: 'basic'
  });

  // License Generator State
  const [licenseForm, setLicenseForm] = useState({
    cnpj: '',
    expiration_date: new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0, 10), // 1 year fallback
    plan_level: 'premium'
  });
  const [generatedLicense, setGeneratedLicense] = useState('');
  const [licenseError, setLicenseError] = useState('');

  // Save admin key locally
  const handleAdminKeyChange = (val) => {
    setAdminKey(val);
    localStorage.setItem('admin_key', val);
  };

  // Helper headers
  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const userToken = localStorage.getItem('token');
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey;
    }
    return headers;
  };

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Health check
      fetch(`${DEFAULT_MIDDLEWARE}/health`)
        .then(r => r.json())
        .then(data => setSystemHealth(data))
        .catch(() => setSystemHealth({ status: 'offline', database: 'offline' }));

      // 2. Companies list
      const compResp = await fetch(`${DEFAULT_MIDDLEWARE}/api/companies`, { headers: getHeaders() });
      if (compResp.ok) {
        const comps = await compResp.json();
        setCompanies(comps);
      }

      // 2.5 Tenants list
      const tenantResp = await fetch(`${DEFAULT_MIDDLEWARE}/api/tenants`, { headers: getHeaders() });
      if (tenantResp.ok) {
        const tenData = await tenantResp.json();
        setTenants(tenData);
      }

      // 3. Audits
      const auditResp = await fetch(`${DEFAULT_MIDDLEWARE}/api/knowledge/audit`, { headers: getHeaders() });
      if (auditResp.ok) {
        const data = await auditResp.json();
        setAudits(data.items || []);
      }

      // 4. Memories
      const memResp = await fetch(`${DEFAULT_MIDDLEWARE}/api/knowledge/memories`, { headers: getHeaders() });
      if (memResp.ok) {
        const data = await memResp.json();
        setMemories(data.items || []);
      }

      // 5. Documents
      const docResp = await fetch(`${DEFAULT_MIDDLEWARE}/api/knowledge/documents`, { headers: getHeaders() });
      if (docResp.ok) {
        const data = await docResp.json();
        setDocuments(data.items || []);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminKey]);

  // CRUD Tenant handlers
  const openTenantModal = (mode, tenant = null) => {
    setTenantModalMode(mode);
    if (mode === 'edit' && tenant) {
      setTenantForm(tenant);
    } else {
      setTenantForm({
        id: '', name: '', protheus_rest_url: '', protheus_user: '', protheus_password: '', auth_mode: 'basic'
      });
    }
    setShowTenantModal(true);
  };

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    const isEdit = tenantModalMode === 'edit';
    const url = isEdit 
      ? `${DEFAULT_MIDDLEWARE}/api/tenants/${tenantForm.id}`
      : `${DEFAULT_MIDDLEWARE}/api/tenants`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const resp = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(tenantForm)
      });
      if (resp.ok) {
        alert(isEdit ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!");
        setShowTenantModal(false);
        fetchData();
      } else {
        const err = await resp.json();
        alert(`Falha ao salvar: ${err.detail || JSON.stringify(err)}`);
      }
    } catch (err) {
      alert(`Erro de conexão: ${err.message}`);
    }
  };

  const handleDeleteTenant = async (id) => {
    if (!confirm("Deseja realmente excluir este Cliente? Essa operação pode ser perigosa e afetar schemas!")) return;
    try {
      const resp = await fetch(`${DEFAULT_MIDDLEWARE}/api/tenants/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (resp.ok) {
        alert("Cliente excluído com sucesso.");
        fetchData();
      } else {
        const err = await resp.json();
        alert(`Erro ao excluir: ${err.detail || "Desconhecido"}`);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  // CRUD Company handlers
  const openCompanyModal = (mode, company = null) => {
    setCompanyModalMode(mode);
    if (mode === 'edit' && company) {
      setCompanyForm(company);
    } else {
      setCompanyForm({
        cnpj: '', ie: '', razao_social: '', email: '', telefone: '', endereco: '',
        protheus_grupo: '', protheus_empresa: '', protheus_unidade: '', protheus_filial: '',
        protheus_ambientes: 'validacao', protheus_usuario: '',
        protheus_rest_url: '', protheus_webapp_url: '', licenca_uso: ''
      });
    }
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    const isEdit = companyModalMode === 'edit';
    const url = isEdit 
      ? `${DEFAULT_MIDDLEWARE}/api/companies/${companyForm.id}`
      : `${DEFAULT_MIDDLEWARE}/api/companies`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const resp = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(companyForm)
      });
      if (resp.ok) {
        alert(isEdit ? "Empresa atualizada com sucesso!" : "Empresa criada com sucesso!");
        setShowCompanyModal(false);
        fetchData();
      } else {
        const err = await resp.json();
        alert(`Falha ao salvar: ${err.detail || JSON.stringify(err)}`);
      }
    } catch (err) {
      alert(`Erro de conexão: ${err.message}`);
    }
  };

  const handleDeleteCompany = async (id) => {
    if (!confirm("Deseja realmente excluir esta empresa?")) return;
    try {
      const resp = await fetch(`${DEFAULT_MIDDLEWARE}/api/companies/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (resp.ok) {
        alert("Empresa excluída com sucesso.");
        fetchData();
      } else {
        const err = await resp.json();
        alert(`Erro ao excluir: ${err.detail || "Desconhecido"}`);
      }
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  // License Generator handler
  const handleGenerateLicense = async (e) => {
    e.preventDefault();
    setGeneratedLicense('');
    setLicenseError('');
    try {
      const resp = await fetch(`${DEFAULT_MIDDLEWARE}/api/license/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(licenseForm)
      });
      if (resp.ok) {
        const data = await resp.json();
        setGeneratedLicense(data.token);
      } else {
        const err = await resp.json();
        setLicenseError(err.detail || "Falha ao gerar licença. Verifique sua Chave Admin.");
      }
    } catch (err) {
      setLicenseError(`Erro de conexão: ${err.message}`);
    }
  };

  // Trigger Ingestion
  const handleTriggerIngest = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${DEFAULT_MIDDLEWARE}/api/knowledge/ingest`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (resp.ok) {
        alert("Processo de ingestão de documentos disparado com sucesso!");
        fetchData();
      } else {
        alert("Erro ao disparar ingestão.");
      }
    } catch (e) {
      alert(`Erro de conexão: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-brand">
          <span>✦ Protheus Control</span>
        </div>
        <div className="admin-menu">
          <button className={`admin-menu-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            📈 Visão Geral
          </button>
          <button className={`admin-menu-item ${activeTab === 'tenants' ? 'active' : ''}`} onClick={() => setActiveTab('tenants')}>
            👥 Clientes
          </button>
          <button className={`admin-menu-item ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')}>
            🏢 Empresas SaaS
          </button>
          <button className={`admin-menu-item ${activeTab === 'licenses' ? 'active' : ''}`} onClick={() => setActiveTab('licenses')}>
            🔑 Licenciamento
          </button>
          <button className={`admin-menu-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            📄 Logs de Auditoria
          </button>
          <button className={`admin-menu-item ${activeTab === 'rag' ? 'active' : ''}`} onClick={() => setActiveTab('rag')}>
            🧠 Base RAG & Memória
          </button>
          <button className={`admin-menu-item ${activeTab === 'db-manager' ? 'active' : ''}`} onClick={() => setActiveTab('db-manager')}>
            🗄️ Banco de Dados
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', textAlign: 'center' }}>
          Versão Administrativa 1.5.0
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {/* Header */}
        <div className="admin-header">
          <h1>Painel de Controle do Administrador</h1>
          <div className="admin-admin-key-input">
            <label style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>Chave Admin (X-Admin-Key):</label>
            <input 
              type="password" 
              value={adminKey} 
              onChange={e => handleAdminKeyChange(e.target.value)} 
              placeholder="Insira a chave secreta" 
            />
            <button className="admin-btn admin-btn-secondary" style={{ padding: '6px 12px' }} onClick={fetchData}>
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* Tab Panel */}
        <div className="admin-content">
          {loading && <div style={{ color: 'var(--admin-accent)', fontWeight: 'bold', marginBottom: '16px' }}>Carregando dados...</div>}

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <>
              {/* Metrics */}
              <div className="admin-metrics-grid">
                <div className="admin-metric-card">
                  <div>
                    <div className="admin-metric-label">Status do Banco</div>
                    <div className="admin-metric-value" style={{ color: systemHealth.database === 'healthy' ? 'var(--admin-success)' : 'var(--admin-error)' }}>
                      {systemHealth.database === 'healthy' ? 'Saudável' : 'Inativo'}
                    </div>
                  </div>
                  <div className="admin-metric-icon">🗄️</div>
                </div>
                <div className="admin-metric-card">
                  <div>
                    <div className="admin-metric-label">Mecanismo de IA (FastAPI)</div>
                    <div className="admin-metric-value" style={{ color: systemHealth.status === 'ok' ? 'var(--admin-success)' : 'var(--admin-error)' }}>
                      {systemHealth.status === 'ok' ? 'No Ar' : 'Offline'}
                    </div>
                  </div>
                  <div className="admin-metric-icon">🚀</div>
                </div>
                <div className="admin-metric-card">
                  <div>
                    <div className="admin-metric-label">Empresas Ativas</div>
                    <div className="admin-metric-value">{companies.length}</div>
                  </div>
                  <div className="admin-metric-icon">🏢</div>
                </div>
                <div className="admin-metric-card">
                  <div>
                    <div className="admin-metric-label">Total de Requisições</div>
                    <div className="admin-metric-value">{audits.length}</div>
                  </div>
                  <div className="admin-metric-icon">📈</div>
                </div>
              </div>

              {/* Recent Audits */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2>Interações Recentes (Histórico Geral)</h2>
                </div>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Tenant</th>
                        <th>Usuário</th>
                        <th>Pergunta</th>
                        <th>Tempo de Resposta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audits.slice(0, 8).map((a, i) => (
                        <tr key={i}>
                          <td>{new Date(a.created_at || Date.now()).toLocaleString()}</td>
                          <td><span className="admin-badge admin-badge-success">{a.tenant_id}</span></td>
                          <td>{a.user_name}</td>
                          <td>{a.question}</td>
                          <td>{a.response_time_ms}ms</td>
                        </tr>
                      ))}
                      {audits.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Nenhuma interação registrada ainda.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {/* Tab 1.5: Tenants (Clientes) CRUD */}
          {activeTab === 'tenants' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2>Clientes Cadastrados</h2>
                <button className="admin-btn admin-btn-primary" onClick={() => openTenantModal('add')}>
                  ➕ Cadastrar Cliente
                </button>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID (Tenant)</th>
                      <th>Nome</th>
                      <th>URL REST</th>
                      <th>Usuário</th>
                      <th>Autenticação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id}>
                        <td><strong>{t.id}</strong></td>
                        <td>{t.name}</td>
                        <td>{t.protheus_rest_url || 'N/A'}</td>
                        <td>{t.protheus_user || 'N/A'}</td>
                        <td>{t.auth_mode}</td>
                        <td>
                          <button className="admin-btn admin-btn-secondary" style={{ padding: '4px 8px', marginRight: '8px' }} onClick={() => openTenantModal('edit', t)}>Editar</button>
                          <button className="admin-btn admin-btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDeleteTenant(t.id)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Nenhum Cliente (Tenant) cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Companies SaaS CRUD */}
          {activeTab === 'companies' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2>Empresas SaaS Cadastradas</h2>
                <button className="admin-btn admin-btn-primary" onClick={() => openCompanyModal('add')}>
                  ➕ Cadastrar Empresa
                </button>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Razão Social</th>
                      <th>CNPJ</th>
                      <th>Grupo Protheus</th>
                      <th>Empresa/Filial</th>
                      <th>URL do Portal REST</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.razao_social}</strong></td>
                        <td>{c.cnpj}</td>
                        <td><span className="admin-badge admin-badge-success">{c.protheus_grupo}</span></td>
                        <td>{c.protheus_empresa}/{c.protheus_filial}</td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{c.protheus_rest_url}</td>
                        <td>
                          <button className="admin-btn admin-btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', marginRight: '6px' }} onClick={() => openCompanyModal('edit', c)}>
                            ✏️ Editar
                          </button>
                          <button className="admin-btn admin-btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--admin-error)', borderColor: 'var(--admin-error)' }} onClick={() => handleDeleteCompany(c.id)}>
                            🗑️ Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {companies.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Nenhuma empresa cadastrada no banco de dados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: License Generator */}
          {activeTab === 'licenses' && (
            <div className="admin-form-row">
              <div className="admin-card" style={{ flex: 1 }}>
                <div className="admin-card-header">
                  <h2>Gerar Novo Token de Licença</h2>
                </div>
                <form onSubmit={handleGenerateLicense}>
                  <div className="admin-form-group">
                    <label>CNPJ do Cliente (Exato cadastrado no banco):</label>
                    <input 
                      type="text" 
                      value={licenseForm.cnpj} 
                      onChange={e => setLicenseForm({ ...licenseForm, cnpj: e.target.value })} 
                      placeholder="Ex: 12345678000199" 
                      required 
                    />
                  </div>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label>Data de Vencimento:</label>
                      <input 
                        type="date" 
                        value={licenseForm.expiration_date} 
                        onChange={e => setLicenseForm({ ...licenseForm, expiration_date: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="admin-form-group">
                      <label>Nível do Plano:</label>
                      <select 
                        value={licenseForm.plan_level} 
                        onChange={e => setLicenseForm({ ...licenseForm, plan_level: e.target.value })}
                      >
                        <option value="premium">Premium (Completo)</option>
                        <option value="standard">Standard (Interações Limitadas)</option>
                        <option value="trial">Trial (Teste Grátis)</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="admin-btn admin-btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                    🔑 Gerar Licença JWT
                  </button>
                </form>
              </div>

              <div className="admin-card" style={{ flex: 1 }}>
                <div className="admin-card-header">
                  <h2>Resultado da Licença Gerada</h2>
                </div>
                
                {licenseError && (
                  <div style={{ color: 'var(--admin-error)', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--admin-error)', fontSize: '13px' }}>
                    {licenseError}
                  </div>
                )}

                {generatedLicense ? (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', margin: '0 0 10px' }}>
                      Copie o token gerado abaixo e cole no campo <strong>Licença de Uso</strong> nas configurações da respectiva empresa.
                    </p>
                    <div className="admin-token-output">
                      {generatedLicense}
                    </div>
                    <button 
                      className="admin-btn admin-btn-secondary" 
                      style={{ width: '100%', marginTop: '12px' }} 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLicense);
                        alert("Token copiado para a área de transferência!");
                      }}
                    >
                      📋 Copiar Token de Licença
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--admin-text-secondary)', fontSize: '14px' }}>
                    Preencha os campos ao lado e clique em gerar para criar a licença criptografada do cliente.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Audit Logs */}
          {activeTab === 'audit' && (
            <div className="admin-card">
              <div className="admin-card-header">
                <h2>Logs Completos de Auditoria</h2>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Tenant</th>
                      <th>Módulo/Tela</th>
                      <th>Usuário</th>
                      <th>Pergunta do Usuário</th>
                      <th>Resposta do Assistente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((a, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.created_at || Date.now()).toLocaleString()}</td>
                        <td><span className="admin-badge admin-badge-success">{a.tenant_id}</span></td>
                        <td><strong>{a.module || 'Geral'}</strong></td>
                        <td>{a.user_name}</td>
                        <td style={{ maxWidth: '240px' }}>{a.question}</td>
                        <td style={{ maxWidth: '300px', fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                          {a.answer && a.answer.length > 250 ? a.answer.slice(0, 250) + "..." : a.answer}
                        </td>
                      </tr>
                    ))}
                    {audits.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Nenhum log de auditoria encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 5: RAG & Memories */}
          {activeTab === 'rag' && (
            <div className="admin-form-row">
              <div className="admin-card" style={{ flex: 1 }}>
                <div className="admin-card-header">
                  <h2>Documentos Ingeridos (Base RAG Vetorial)</h2>
                  <button className="admin-btn admin-btn-primary" onClick={handleTriggerIngest}>
                    🚀 Disparar Ingestão Geral
                  </button>
                </div>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID Documento</th>
                        <th>Título / Path</th>
                        <th>Tenant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((d, i) => (
                        <tr key={i}>
                          <td>{d.id || i}</td>
                          <td><strong>{d.title || d.file_path}</strong></td>
                          <td><span className="admin-badge admin-badge-success">{d.tenant_id}</span></td>
                        </tr>
                      ))}
                      {documents.length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Nenhum documento carregado no pgvector.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card" style={{ flex: 1 }}>
                <div className="admin-card-header">
                  <h2>Memórias Persistentes de Longo Prazo</h2>
                </div>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Chave da Memória</th>
                        <th>Valor Armazenado</th>
                        <th>Tenant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memories.map((m, i) => (
                        <tr key={i}>
                          <td><code>{m.memory_key}</code></td>
                          <td style={{ fontSize: '13px' }}>{m.memory_value}</td>
                          <td><span className="admin-badge admin-badge-success">{m.tenant_id}</span></td>
                        </tr>
                      ))}
                      {memories.length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', color: 'var(--admin-text-secondary)' }}>Nenhuma memória gravada ainda.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Database Manager (Adminer) */}
          {activeTab === 'db-manager' && (
            <div className="admin-card" style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
              <div className="admin-card-header" style={{ marginBottom: '12px' }}>
                <h2>Gerenciador de Banco de Dados (Adminer)</h2>
                <a 
                  href="/adminer/?pgsql=db&username=postgres&db=copilot_protheus" 
                  target="_blank" 
                  rel="noreferrer"
                  className="admin-btn admin-btn-primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  ↗️ Abrir em Nova Aba
                </a>
              </div>
              <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--admin-border)', background: '#fff' }}>
                <iframe 
                  src="/adminer/?pgsql=db&username=postgres&db=copilot_protheus" 
                  title="Adminer Database Manager"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CRUD Company Modal */}
      {showCompanyModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2>{companyModalMode === 'edit' ? '✏️ Editar Configurações de Empresa' : '🏢 Cadastrar Nova Empresa'}</h2>
              <button className="admin-modal-close" onClick={() => setShowCompanyModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveCompany}>
              <h3>Dados da Empresa</h3>
              <div className="admin-form-group">
                <label>Razão Social:</label>
                <input 
                  type="text" 
                  value={companyForm.razao_social} 
                  onChange={e => setCompanyForm({ ...companyForm, razao_social: e.target.value })} 
                  placeholder="Ex: Rodol Ltda" 
                  required 
                />
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>CNPJ (Somente Números):</label>
                  <input 
                    type="text" 
                    value={companyForm.cnpj} 
                    onChange={e => setCompanyForm({ ...companyForm, cnpj: e.target.value })} 
                    placeholder="Ex: 12345678000199" 
                    required 
                  />
                </div>
                <div className="admin-form-group">
                  <label>Inscrição Estadual:</label>
                  <input 
                    type="text" 
                    value={companyForm.ie} 
                    onChange={e => setCompanyForm({ ...companyForm, ie: e.target.value })} 
                    placeholder="Ex: 123456789" 
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>E-mail Corporativo:</label>
                  <input 
                    type="email" 
                    value={companyForm.email} 
                    onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} 
                    placeholder="Ex: admin@empresa.com" 
                  />
                </div>
                <div className="admin-form-group">
                  <label>Telefone:</label>
                  <input 
                    type="text" 
                    value={companyForm.telefone} 
                    onChange={e => setCompanyForm({ ...companyForm, telefone: e.target.value })} 
                    placeholder="Ex: (11) 99999-9999" 
                  />
                </div>
              </div>

              <h3 style={{ marginTop: '24px' }}>Parâmetros TOTVS Protheus</h3>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Cliente (Tenant) / Grupo Protheus:</label>
                  <select
                    value={companyForm.protheus_grupo}
                    onChange={e => setCompanyForm({ ...companyForm, protheus_grupo: e.target.value })}
                    required
                  >
                    <option value="" disabled>Selecione um Cliente</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Código da Empresa:</label>
                  <input 
                    type="text" 
                    value={companyForm.protheus_empresa} 
                    onChange={e => setCompanyForm({ ...companyForm, protheus_empresa: e.target.value })} 
                    placeholder="Ex: 01" 
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Código da Filial:</label>
                  <input 
                    type="text" 
                    value={companyForm.protheus_filial} 
                    onChange={e => setCompanyForm({ ...companyForm, protheus_filial: e.target.value })} 
                    placeholder="Ex: 0101" 
                    required 
                  />
                </div>
                <div className="admin-form-group">
                  <label>Ambiente de Trabalho:</label>
                  <select 
                    value={companyForm.protheus_ambientes} 
                    onChange={e => setCompanyForm({ ...companyForm, protheus_ambientes: e.target.value })}
                  >
                    <option value="validacao">Validação / Homologação</option>
                    <option value="producao">Produção</option>
                    <option value="teste">Teste</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-group">
                <label>Usuário Protheus Autorizado (Separe múltiplos por vírgula):</label>
                <input 
                  type="text" 
                  value={companyForm.protheus_usuario} 
                  onChange={e => setCompanyForm({ ...companyForm, protheus_usuario: e.target.value })} 
                  placeholder="Ex: murilo, admin, financeiro" 
                />
              </div>

              <div className="admin-form-group">
                <label>URL do Portal REST do Protheus:</label>
                <input 
                  type="text" 
                  value={companyForm.protheus_rest_url} 
                  onChange={e => setCompanyForm({ ...companyForm, protheus_rest_url: e.target.value })} 
                  placeholder="Ex: https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest" 
                  required 
                />
              </div>

              <div className="admin-form-group">
                <label>URL do WebApp / WebClient do Protheus:</label>
                <input 
                  type="text" 
                  value={companyForm.protheus_webapp_url} 
                  onChange={e => setCompanyForm({ ...companyForm, protheus_webapp_url: e.target.value })} 
                  placeholder="Ex: https://rodolltda195384.protheus.cloudtotvs.com.br:10703/webapp/index.html" 
                />
              </div>

              <div className="admin-form-group">
                <label>Token de Licença de Uso (JWT):</label>
                <textarea 
                  value={companyForm.licenca_uso} 
                  onChange={e => setCompanyForm({ ...companyForm, licenca_uso: e.target.value })} 
                  placeholder="Cole aqui o token de licença JWT gerado" 
                  style={{ height: '70px', resize: 'none' }}
                />
              </div>

              <div className="admin-form-row" style={{ marginTop: '24px' }}>
                <button type="submit" className="admin-btn admin-btn-primary">
                  💾 {companyModalMode === 'edit' ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                </button>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowCompanyModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Tenant Modal */}
      {showTenantModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal" style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h2>{tenantModalMode === 'edit' ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
              <button className="admin-modal-close" onClick={() => setShowTenantModal(false)}>✕</button>
            </div>
            <form className="admin-modal-body" onSubmit={handleSaveTenant}>
              <div className="admin-form-group">
                <label>ID do Cliente (Tenant ID) *</label>
                <input 
                  type="text" 
                  value={tenantForm.id} 
                  onChange={e => setTenantForm({ ...tenantForm, id: e.target.value })} 
                  placeholder="Ex: rodolltda" 
                  disabled={tenantModalMode === 'edit'}
                  required 
                />
                <span style={{ fontSize: '11px', color: '#8b8b8b' }}>Apenas letras minúsculas, sem espaços. Será usado como nome do schema no banco de dados.</span>
              </div>
              <div className="admin-form-group">
                <label>Nome do Cliente *</label>
                <input 
                  type="text" 
                  value={tenantForm.name} 
                  onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} 
                  placeholder="Ex: Rodol Ltda" 
                  required 
                />
              </div>

              <h3 style={{ marginTop: '24px' }}>Parâmetros Globais TOTVS Protheus</h3>
              <div className="admin-form-group">
                <label>URL do Portal REST (Principal):</label>
                <input 
                  type="url" 
                  value={tenantForm.protheus_rest_url} 
                  onChange={e => setTenantForm({ ...tenantForm, protheus_rest_url: e.target.value })} 
                  placeholder="Ex: https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest" 
                />
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Usuário Mestre Protheus:</label>
                  <input 
                    type="text" 
                    value={tenantForm.protheus_user} 
                    onChange={e => setTenantForm({ ...tenantForm, protheus_user: e.target.value })} 
                    placeholder="Ex: admin" 
                  />
                </div>
                <div className="admin-form-group">
                  <label>Senha do Protheus {tenantModalMode === 'edit' ? '(Deixe em branco para manter)' : '(Opcional)'}:</label>
                  <input 
                    type="password" 
                    value={tenantForm.protheus_password} 
                    onChange={e => setTenantForm({ ...tenantForm, protheus_password: e.target.value })} 
                    placeholder="***" 
                  />
                </div>
              </div>

              <div className="admin-form-row" style={{ marginTop: '24px' }}>
                <button type="submit" className="admin-btn admin-btn-primary">
                  {tenantModalMode === 'edit' ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowTenantModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
