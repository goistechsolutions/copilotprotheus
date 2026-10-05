import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Scale, RefreshCw, AlertCircle, Plus, Trash2, CheckCircle2,
  ShoppingCart, ShoppingBag, DollarSign, Package, FileText,
  BrainCircuit, BookOpen, History, Save, Filter
} from 'lucide-react';
import {
  createCfopRule,
  createFinancialNature,
  createTesRule,
  deleteCfopRule,
  deleteFinancialNature,
  deleteTesRule,
  getBusinessRulesData,
  getBusinessRulesMetadata,
  getBusinessRulesTenants,
  updateBusinessRulesConfig,
} from '../../services/businessRulesApi';
import PageHeader from '../../components/ui/PageHeader';

const ConfigSourceBadge = ({ source }) => {
  if (source === 'EXPLICIT') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Configuração Específica</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Padrão do Sistema</span>;
};

export default function BusinessRulesPage() {
  const [searchParams] = useSearchParams();
  const tenantParam = searchParams.get('tenant');

  const [tenants, setTenants] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(tenantParam || '');
  const [activeTab, setActiveTab] = useState('comercial');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab Data States
  const [tesSaidaList, setTesSaidaList] = useState([]);
  const [tesEntradaList, setTesEntradaList] = useState([]);
  const [cfopList, setCfopList] = useState([]);
  const [naturesList, setNaturesList] = useState([]);
  const [synonymsList, setSynonymsList] = useState([]);
  const [auditList, setAuditList] = useState([]);
  const [config, setConfig] = useState({});

  // Modal / Add States
  const [showAddTesModal, setShowAddTesModal] = useState(false);
  const [newTes, setNewTes] = useState({ tes: '', direction: 'saida', classification: '', description: '' });

  const [showAddCfopModal, setShowAddCfopModal] = useState(false);
  const [newCfop, setNewCfop] = useState({ cfop: '', classification: '' });

  const [showAddNatureModal, setShowAddNatureModal] = useState(false);
  const [newNature, setNewNature] = useState({ nature_code: '', nature_name: '', financial_group: '' });

  const [showAddSynonymModal, setShowAddSynonymModal] = useState(false);
  const [newSynonym, setNewSynonym] = useState({ source_term: '', target_term: '' });

  const firstClassificationFor = direction => (
    metadata?.classifications?.tes?.find(option => option.directions?.includes(direction))?.value || ''
  );
  const tesOptions = metadata?.classifications?.tes || [];
  const cfopOptions = metadata?.classifications?.cfop || [];
  const financialGroups = metadata?.financialGroups || [];
  const cashFlowTables = metadata?.cashFlowTables || [];

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await getBusinessRulesMetadata();
        setMetadata(data);
        setConfig(data.defaults || {});
      } catch (e) {
        setError(e.response?.data?.detail || 'Erro ao carregar metadata das regras de negócio');
      }
    };
    loadMetadata();
    loadTenants();
  }, []);

  useEffect(() => {
    if (tenantParam) {
      setSelectedTenant(tenantParam);
    }
  }, [tenantParam]);

  useEffect(() => {
    if (selectedTenant) {
      loadAllData(selectedTenant);
    }
  }, [selectedTenant]);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const loadTenants = async () => {
    try {
      const list = await getBusinessRulesTenants();
      setTenants(list);
      if (list.length > 0 && !selectedTenant && !tenantParam) {
        setSelectedTenant(String(list[0].tenant_code || list[0].id));
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar lista de tenants');
    }
  };

  const loadAllData = async (tid) => {
    setLoading(true);
    setError('');
    try {
      const data = await getBusinessRulesData(tid);
      setOverview(data.overview);
      setTesSaidaList(data.tesSaida);
      setTesEntradaList(data.tesEntrada);
      setCfopList(data.cfop);
      setNaturesList(data.financialNatures);
      setSynonymsList(data.synonyms);
      if (data.config) setConfig(data.config);
      setAuditList(data.audit);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar dados do Business Rules Center');
    } finally {
      setLoading(false);
    }
  };

  // Handlers: TES
  const handleCreateTes = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTesRule(selectedTenant, newTes);
      setShowAddTesModal(false);
      setNewTes({ tes: '', direction: newTes.direction, classification: firstClassificationFor(newTes.direction), description: '' });
      showNotification('Regra de TES adicionada com sucesso!');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao salvar TES');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTes = async (id) => {
    if (!confirm('Deseja realmente remover esta regra de TES?')) return;
    try {
      await deleteTesRule(selectedTenant, id);
      showNotification('Regra de TES removida');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  // Handlers: CFOP
  const handleCreateCfop = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createCfopRule(selectedTenant, newCfop);
      setShowAddCfopModal(false);
      setNewCfop({ cfop: '', classification: cfopOptions[0]?.value || '' });
      showNotification('CFOP cadastrada com sucesso!');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao salvar CFOP');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCfop = async (id) => {
    if (!confirm('Deseja remover esta regra de CFOP?')) return;
    try {
      await deleteCfopRule(selectedTenant, id);
      showNotification('CFOP removida');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  // Handlers: Naturezas Financeiras
  const handleCreateNature = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createFinancialNature(selectedTenant, newNature);
      setShowAddNatureModal(false);
      setNewNature({ nature_code: '', nature_name: '', financial_group: financialGroups[0]?.value || '' });
      showNotification('Natureza Financeira cadastrada!');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao salvar Natureza Financeira');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNature = async (id) => {
    if (!confirm('Deseja remover esta Natureza Financeira?')) return;
    try {
      await deleteFinancialNature(selectedTenant, id);
      showNotification('Natureza Financeira removida');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  // Handlers: Sinônimos
  const handleCreateSynonym = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createSynonym(selectedTenant, newSynonym);
      setShowAddSynonymModal(false);
      setNewSynonym({ source_term: '', target_term: '' });
      showNotification('Sinônimo cadastrado com sucesso!');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao salvar Sinônimo');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSynonym = async (id) => {
    if (!confirm('Deseja remover este sinônimo?')) return;
    try {
      await deleteSynonym(selectedTenant, id);
      showNotification('Sinônimo removido');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  // Handlers: Salvar Configurações Gerais
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await updateBusinessRulesConfig(selectedTenant, config);
      showNotification('Configurações atualizadas com sucesso!');
      loadAllData(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao atualizar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleBillingClassification = (type, category) => {
    if (type === 'included') {
      const current = [...(config.billing_included_classifications || [])];
      const next = current.includes(category)
        ? current.filter(c => c !== category)
        : [...current, category];
      setConfig(prev => ({ ...prev, billing_included_classifications: next }));
    } else {
      const current = [...(config.billing_excluded_classifications || [])];
      const next = current.includes(category)
        ? current.filter(c => c !== category)
        : [...current, category];
      setConfig(prev => ({ ...prev, billing_excluded_classifications: next }));
    }
  };

  const tabs = [
    { id: 'comercial', label: 'Comercial', icon: ShoppingCart },
    { id: 'compras', label: 'Compras', icon: ShoppingBag },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'fiscal', label: 'Fiscal', icon: FileText },
    { id: 'ia_abc', label: 'IA & Curva ABC', icon: BrainCircuit },
    
    { id: 'auditoria', label: 'Auditoria', icon: History },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Rules Center"
        description="Configure as regras de negócio, interpretações e filtros específicos do tenant sem alterar código ou redeploy."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadAllData(selectedTenant)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        }
      />

      {/* Seletor de Tenant & Painel Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border border-[#1E293B] bg-[#121622]">
        <div className="md:col-span-2 flex flex-col justify-center">
          <label className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Empresa / Tenant Ativo
          </label>
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-cyan-500"
          >
            {tenants.map(t => (
              <option key={t.id || t.tenant_code} value={t.tenant_code || t.id}>
                {t.tenant_code || t.name} — {t.name || t.tenant_code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0F121C] border border-[#1E293B]">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Total de Regras Ativas</div>
            <div className="text-xl font-bold text-white">
              {overview?.total_active_rules ?? overview?.counts?.active_rules_total ?? 0}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0F121C] border border-[#1E293B]">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Última Atualização</div>
            <div className="text-xs font-semibold text-slate-200">
              {overview?.last_update || overview?.last_updated
                ? new Date(overview.last_update || overview.last_updated).toLocaleString('pt-BR')
                : 'Sem registros'}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-[#1E293B] gap-2 overflow-x-auto pb-px">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-cyan-500 text-cyan-400 bg-[#0F172A]'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#121622]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="rounded-xl border border-[#1E293B] bg-[#121622] p-6">
        {/* 1. ABA COMERCIAL */}
        {activeTab === 'comercial' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">TES de Saída & Faturamento</h3>
                <p className="text-xs text-slate-400">Classificação de Tipos de Entrada e Saída (SF4) para determinar faturamento e deduções.</p>
              </div>
              <button
                onClick={() => {
                  setNewTes({ tes: '', direction: 'saida', classification: firstClassificationFor('saida'), description: '' });
                  setShowAddTesModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar TES de Saída
              </button>
            </div>

            {/* Tabela de TES Saída */}
            <div className="border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0F172A] text-slate-400 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">TES</th>
                    <th className="px-4 py-3 font-semibold">Classificação</th>
                    <th className="px-4 py-3 font-semibold">Descrição</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {tesSaidaList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-6 text-center text-slate-500">Nenhuma TES de saída cadastrada.</td>
                    </tr>
                  ) : (
                    tesSaidaList.map(t => (
                      <tr key={t.id} className="hover:bg-[#0F172A]/50">
                        <td className="px-4 py-3 font-mono text-cyan-400 font-bold">{t.tes}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            t.classification === 'Venda' ? 'bg-emerald-500/20 text-emerald-400' :
                            t.classification === 'Bonificação' ? 'bg-purple-500/20 text-purple-400' :
                            t.classification === 'Devolução' ? 'bg-rose-500/20 text-rose-400' :
                            'bg-slate-500/20 text-slate-300'
                          }`}>
                            {t.classification}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{t.description || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">Ativo</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteTes(t.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition"
                            title="Excluir regra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Composição do Faturamento */}
            <div className="p-4 rounded-lg bg-[#0E131F] border border-[#1E293B] space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Composição do Faturamento Líquido</h4>
                <ConfigSourceBadge source={config._source} />
              </div>
              <p className="text-xs text-slate-400">Marque quais classificações entram no cálculo da receita e quais são desconsideradas nas consultas geradas pela IA.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {tesOptions.filter(option => option.directions?.includes('saida')).map(option => {
                  const cat = option.value;
                  const isIncluded = (config.billing_included_classifications || []).includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded bg-[#0F172A] border border-[#1E293B]">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => toggleBillingClassification('included', cat)}
                        className="rounded border-[#2B3850] text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Composição
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. ABA COMPRAS */}
        {activeTab === 'compras' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">TES de Entrada & Compras</h3>
                <p className="text-xs text-slate-400">Classificação de Tipos de Entrada para compras de mercadorias, insumos, devoluções recebidas e remessas.</p>
              </div>
              <button
                onClick={() => {
                  setNewTes({ tes: '', direction: 'entrada', classification: firstClassificationFor('entrada'), description: '' });
                  setShowAddTesModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar TES de Entrada
              </button>
            </div>

            <div className="border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0F172A] text-slate-400 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">TES</th>
                    <th className="px-4 py-3 font-semibold">Classificação</th>
                    <th className="px-4 py-3 font-semibold">Descrição</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {tesEntradaList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-6 text-center text-slate-500">Nenhuma TES de entrada cadastrada.</td>
                    </tr>
                  ) : (
                    tesEntradaList.map(t => (
                      <tr key={t.id} className="hover:bg-[#0F172A]/50">
                        <td className="px-4 py-3 font-mono text-cyan-400 font-bold">{t.tes}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400">
                            {t.classification}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{t.description || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-400 font-medium">Ativo</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteTes(t.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition"
                            title="Excluir regra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ABA FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Naturezas Financeiras & Recebíveis</h3>
                <p className="text-xs text-slate-400">Mapeamento de naturezas do Protheus (SED) para DRE/Fluxo de Caixa e regras de cobrança.</p>
              </div>
              <button
                onClick={() => setShowAddNatureModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Natureza
              </button>
            </div>

            <div className="border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0F172A] text-slate-400 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Código Natureza</th>
                    <th className="px-4 py-3 font-semibold">Descrição</th>
                    <th className="px-4 py-3 font-semibold">Grupo Financeiro</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {naturesList.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-slate-500">Nenhuma natureza cadastrada para este tenant.</td>
                    </tr>
                  ) : (
                    naturesList.map(n => (
                      <tr key={n.id} className="hover:bg-[#0F172A]/50">
                        <td className="px-4 py-3 font-mono text-cyan-400 font-bold">{n.nature_code}</td>
                        <td className="px-4 py-3 text-slate-200 font-medium">{n.nature_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {n.financial_group}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteNature(n.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Parâmetros de Recebíveis */}
            <div className="p-4 rounded-lg bg-[#0E131F] border border-[#1E293B] space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Políticas de Contas a Receber (SE1)</h4>
                <ConfigSourceBadge source={config._source} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dias para considerar Título Vencido / Inadimplente</label>
                  <input
                    type="number"
                    value={config.receivables_overdue_days ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, receivables_overdue_days: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.receivables_include_renegotiated || false}
                      onChange={e => setConfig(prev => ({ ...prev, receivables_include_renegotiated: e.target.checked }))}
                      className="rounded border-[#2B3850] text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Incluir títulos renegociados nas análises</span>
                  </label>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.receivables_include_provisional || false}
                      onChange={e => setConfig(prev => ({ ...prev, receivables_include_provisional: e.target.checked }))}
                      className="rounded border-[#2B3850] text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Incluir títulos provisórios (ex: PR)</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Parâmetros Financeiros
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. ABA ESTOQUE */}
        {activeTab === 'estoque' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Parâmetros de Gestão de Estoque (SB2 / SB1)</h3>
                <ConfigSourceBadge source={config._source} />
              </div>
              <p className="text-xs text-slate-400">Definição dos horizontes temporais para alerta de obsolescência, estoque crítico e ruptura.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-[#0E131F] border border-[#1E293B]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Produto Parado / Sem Giro (Dias)</label>
                <input
                  type="number"
                  value={config.stock_idle_days ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, stock_idle_days: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">Gera alertas de obsolescência e excesso de estoque.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Estoque Crítico (Dias de Cobertura)</label>
                <input
                  type="number"
                  value={config.stock_critical_days ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, stock_critical_days: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">Dispara alerta amarelo de necessidade de compra.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Risco de Ruptura (Dias)</label>
                <input
                  type="number"
                  value={config.stock_rupture_days ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, stock_rupture_days: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">Dispara alerta vermelho de desabastecimento iminente.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <Save className="w-3.5 h-3.5" /> Salvar Regras de Estoque
              </button>
            </div>
          </div>
        )}

        {/* 5. ABA FISCAL */}
        {activeTab === 'fiscal' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Classificação de CFOPs Fiscais</h3>
                <p className="text-xs text-slate-400">Interpretação e mapeamento de CFOPs específicas utilizadas pelo departamento fiscal deste tenant.</p>
              </div>
              <button
                onClick={() => setShowAddCfopModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar CFOP
              </button>
            </div>

            <div className="border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0F172A] text-slate-400 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">CFOP</th>
                    <th className="px-4 py-3 font-semibold">Classificação de Negócio</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {cfopList.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-6 text-center text-slate-500">Nenhuma CFOP cadastrada para este tenant.</td>
                    </tr>
                  ) : (
                    cfopList.map(c => (
                      <tr key={c.id} className="hover:bg-[#0F172A]/50">
                        <td className="px-4 py-3 font-mono text-cyan-400 font-bold">{c.cfop}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.classification}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteCfop(c.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. ABA IA & CURVA ABC */}
        {activeTab === 'ia_abc' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Parâmetros de IA & Curva ABC</h3>
                <ConfigSourceBadge source={config._source} />
              </div>
              <p className="text-xs text-slate-400">Configure a distribuição percentual da Curva de Pareto (ABC) e tabelas financeiras prioritárias.</p>
            </div>

            <div className="p-4 rounded-lg bg-[#0E131F] border border-[#1E293B] space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cortes Percentuais da Curva ABC</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Classe A (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.abc_curve_a_pct || 80.0}
                    onChange={e => setConfig(prev => ({ ...prev, abc_curve_a_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Percentual acumulado principal (geralmente 80%).</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">Classe B (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.abc_curve_b_pct || 15.0}
                    onChange={e => setConfig(prev => ({ ...prev, abc_curve_b_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Percentual intermediário (geralmente 15%).</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-400 mb-1">Classe C (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.abc_curve_c_pct || 5.0}
                    onChange={e => setConfig(prev => ({ ...prev, abc_curve_c_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-[#263550] bg-[#0F172A] px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Percentual de cauda longa (geralmente 5%).</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1E293B]">
                <label className="block text-xs font-semibold text-slate-300 mb-2">Tabelas Protheus Prioritárias para Análise de Fluxo de Caixa</label>
                <div className="flex gap-4">
                  {cashFlowTables.map(tbl => {
                    const isSelected = (config.ai_cash_flow_tables || []).includes(tbl);
                    return (
                      <label key={tbl} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-2 rounded bg-[#0F172A] border border-[#1E293B]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const current = [...(config.ai_cash_flow_tables || [])];
                            const next = current.includes(tbl) ? current.filter(x => x !== tbl) : [...current, tbl];
                            setConfig(prev => ({ ...prev, ai_cash_flow_tables: next }));
                          }}
                          className="rounded border-[#2B3850] text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="font-mono">{tbl}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Parâmetros IA & ABC
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. ABA SINÔNIMOS */}
        {activeTab === 'auditoria' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white">Histórico de Auditoria e Governança</h3>
              <p className="text-xs text-slate-400">Rastreabilidade completa de todas as alterações realizadas nas regras de negócio da empresa.</p>
            </div>

            <div className="border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0F172A] text-slate-400 border-b border-[#1E293B]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Data / Hora</th>
                    <th className="px-4 py-3 font-semibold">Usuário</th>
                    <th className="px-4 py-3 font-semibold">Entidade</th>
                    <th className="px-4 py-3 font-semibold">Ação</th>
                    <th className="px-4 py-3 font-semibold">Detalhes</th>
                    <th className="px-4 py-3 font-semibold">Trace ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {auditList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-slate-500">Nenhum registro de auditoria encontrado.</td>
                    </tr>
                  ) : (
                    auditList.map(a => (
                      <tr key={a.id} className="hover:bg-[#0F172A]/50">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {new Date(a.event_date).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">{a.user_id}</td>
                        <td className="px-4 py-3 font-medium text-white">{a.rule_entity}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-400' :
                            a.action === 'UPDATE' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-rose-500/20 text-rose-400'
                          }`}>
                            {a.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[11px] font-mono text-slate-400 max-w-md truncate">
                            {JSON.stringify(a.new_value || a.previous_value)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                          {a.trace_id || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAIS DE CADASTRO */}
      {/* Modal: TES */}
      {showAddTesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Regra de TES</h3>
            <form onSubmit={handleCreateTes} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Código da TES (SF4)</label>
                <input
                  required
                  maxLength="10"
                  value={newTes.tes}
                  onChange={e => setNewTes(prev => ({ ...prev, tes: e.target.value.trim() }))}
                  placeholder="Ex: 501"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Direção</label>
                <select
                  value={newTes.direction}
                  onChange={e => setNewTes(prev => ({ ...prev, direction: e.target.value }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  <option value="saida">Saída (Faturamento / Vendas)</option>
                  <option value="entrada">Entrada (Compras / Insumos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Classificação de Negócio</label>
                <select
                  value={newTes.classification}
                  onChange={e => setNewTes(prev => ({ ...prev, classification: e.target.value }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  {tesOptions
                    .filter(option => option.directions?.includes(newTes.direction))
                    .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Descrição</label>
                <input
                  value={newTes.description}
                  onChange={e => setNewTes(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Venda no mercado interno"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddTesModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: CFOP */}
      {showAddCfopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Regra de CFOP</h3>
            <form onSubmit={handleCreateCfop} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Código CFOP</label>
                <input
                  required
                  maxLength="10"
                  value={newCfop.cfop}
                  onChange={e => setNewCfop(prev => ({ ...prev, cfop: e.target.value.trim() }))}
                  placeholder="Ex: 5101"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Classificação de Negócio</label>
                <select
                  value={newCfop.classification}
                  onChange={e => setNewCfop(prev => ({ ...prev, classification: e.target.value }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  {cfopOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddCfopModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar CFOP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Natureza Financeira */}
      {showAddNatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Natureza Financeira</h3>
            <form onSubmit={handleCreateNature} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Código da Natureza (SED)</label>
                <input
                  required
                  value={newNature.nature_code}
                  onChange={e => setNewNature(prev => ({ ...prev, nature_code: e.target.value.trim() }))}
                  placeholder="Ex: 101"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome / Descrição da Natureza</label>
                <input
                  required
                  value={newNature.nature_name}
                  onChange={e => setNewNature(prev => ({ ...prev, nature_name: e.target.value }))}
                  placeholder="Ex: Salários e Ordenados"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Grupo Financeiro</label>
                <select
                  value={newNature.financial_group}
                  onChange={e => setNewNature(prev => ({ ...prev, financial_group: e.target.value }))}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  {financialGroups.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddNatureModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Natureza'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sinônimo */}
      {showAddSynonymModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Sinônimo Empresarial</h3>
            <form onSubmit={handleCreateSynonym} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Termo do Usuário / Negócio</label>
                <input
                  required
                  value={newSynonym.source_term}
                  onChange={e => setNewSynonym(prev => ({ ...prev, source_term: e.target.value }))}
                  placeholder="Ex: Receita"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Termo Técnico Protheus Equivalente</label>
                <input
                  required
                  value={newSynonym.target_term}
                  onChange={e => setNewSynonym(prev => ({ ...prev, target_term: e.target.value }))}
                  placeholder="Ex: Faturamento"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddSynonymModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Sinônimo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
