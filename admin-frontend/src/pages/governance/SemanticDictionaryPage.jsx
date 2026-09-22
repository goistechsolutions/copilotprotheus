import { useState, useEffect } from 'react';
import { BookMarked, RefreshCw, AlertCircle, Plus, Trash2, Search, ChevronDown } from 'lucide-react';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

export default function SemanticDictionaryPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Form novo alias
  const [showModal, setShowModal] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fieldFormat, setFieldFormat] = useState('text');
  const [fieldDescription, setFieldDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      loadAliases(selectedTenant);
    } else {
      setAliases([]);
    }
  }, [selectedTenant]);

  const loadTenants = async () => {
    try {
      const res = await api.get('/api/tenants');
      const list = res.data?.tenants || res.data || [];
      setTenants(list);
      if (list.length > 0) {
        const first = list[0].tenant_code || list[0].id;
        setSelectedTenant(String(first));
      }
    } catch (e) {
      setError('Erro ao carregar tenants');
    }
  };

  const loadAliases = async (tenantId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/admin/governance/semantic-dictionary?tenant_id=${encodeURIComponent(tenantId)}`);
      setAliases(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar aliases semânticos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!fieldName || !businessName) return;
    setSaving(true);
    try {
      await api.post('/api/admin/governance/semantic-dictionary', {
        tenant_id: selectedTenant,
        field_name: fieldName,
        business_name: businessName,
        field_format: fieldFormat,
        field_description: fieldDescription,
      });
      setShowModal(false);
      setFieldName('');
      setBusinessName('');
      setFieldDescription('');
      loadAliases(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao criar alias');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover este termo semântico?')) return;
    try {
      await api.delete(`/api/admin/governance/semantic-dictionary/${id}?tenant_id=${encodeURIComponent(selectedTenant)}`);
      loadAliases(selectedTenant);
    } catch (e) {
      alert(e.response?.data?.detail || 'Erro ao excluir');
    }
  };

  const filtered = aliases.filter(a =>
    a.field_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.field_description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Dicionário Semântico"
        description="Tradução de campos técnicos do SX3 para vocabulário e conceitos executivos do negócio."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowModal(true)}
              disabled={!selectedTenant}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Termo
            </button>
            <button
              onClick={() => loadAliases(selectedTenant)}
              disabled={!selectedTenant || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        }
      />

      {/* Controles: Seleção de Tenant & Busca */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative">
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            className="appearance-none bg-[#0F172A] border border-[#1E293B] text-white text-xs rounded-lg pl-3 pr-8 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
          >
            {tenants.map(t => {
              const code = t.tenant_code || t.id;
              const name = t.name || t.tenant_name || code;
              return <option key={t.id} value={code}>{code} — {name}</option>;
            })}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4] pointer-events-none" />
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por campo físico ou termo amigável..."
            className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2 text-white text-xs placeholder-[#8892A4]/50 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tabela de Aliases */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#020817] border-b border-[#1E293B] text-[#8892A4] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Campo Físico (SX3)</th>
                <th className="px-4 py-3">Nome de Negócio</th>
                <th className="px-4 py-3">Formato</th>
                <th className="px-4 py-3">Descrição / Contexto</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Carregando vocabulário semântico...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    Nenhum termo semântico cadastrado para este tenant.
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="hover:bg-[#1E293B]/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-300">{row.field_name}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.business_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {row.field_format || 'text'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#8892A4] max-w-xs truncate">{row.field_description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Alias */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4">Adicionar Termo Semântico</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Campo Protheus (Ex: E1_VALOR, F2_DOC)</label>
                <input
                  required
                  value={fieldName}
                  onChange={e => setFieldName(e.target.value.toUpperCase())}
                  placeholder="Ex: E1_SALDO"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome Executivo (Amigável)</label>
                <input
                  required
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="Ex: Saldo em Aberto"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Formato</label>
                <select
                  value={fieldFormat}
                  onChange={e => setFieldFormat(e.target.value)}
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                >
                  <option value="text">Texto</option>
                  <option value="currency">Moeda (R$)</option>
                  <option value="date">Data (DD/MM/AAAA)</option>
                  <option value="percentage">Percentual (%)</option>
                  <option value="integer">Número Inteiro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Descrição / Instrução de Negócio</label>
                <textarea
                  rows="2"
                  value={fieldDescription}
                  onChange={e => setFieldDescription(e.target.value)}
                  placeholder="Ex: Utilizado para apurar inadimplência."
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Termo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
