import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import { Search, Plus, Trash2, Edit2, AlertCircle, RefreshCw, ChevronDown, BookOpen } from 'lucide-react';

export default function SemanticDictionaryPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Form Modal
  const [modal, setModal] = useState(null); // null | 'new' | { ...alias }
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
      const res = await axios.get('/api/tenants');
      const data = Array.isArray(res.data) ? res.data : (res.data?.items ?? res.data?.tenants ?? []);
      setTenants(data);
      if (data.length > 0) {
        setSelectedTenant(data[0].tenant_code || data[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar tenants:", err);
    }
  };

  const loadAliases = async (tenantId) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/admin/governance/semantic-dictionary?tenant_id=${encodeURIComponent(tenantId)}`);
      setAliases(res.data?.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Falha ao carregar vocabulário semântico.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        tenant_id: selectedTenant,
        field_name: modal.field_name,
        business_name: modal.business_name,
        field_format: modal.field_format,
        field_description: modal.field_description,
        synonyms: modal.synonyms || ''
      };

      if (modal.id) {
        await axios.put(`/api/admin/governance/semantic-dictionary/${modal.id}`, payload);
      } else {
        await axios.post('/api/admin/governance/semantic-dictionary', payload);
      }
      setModal(null);
      loadAliases(selectedTenant);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Erro ao salvar termo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este termo semântico definitivamente?')) return;
    try {
      await axios.delete(`/api/admin/governance/semantic-dictionary/${id}?tenant_id=${encodeURIComponent(selectedTenant)}`);
      loadAliases(selectedTenant);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Falha ao excluir termo.');
    }
  };

  const openNew = () => {
    if (!selectedTenant) return alert('Selecione um tenant primeiro.');
    setModal({
      field_name: '',
      business_name: '',
      field_format: 'text',
      field_description: '',
      synonyms: ''
    });
  };

  const openEdit = (row) => {
    setModal({ ...row });
  };

  const filtered = aliases.filter(a => {
    const q = search.toLowerCase();
    return !q ||
      a.field_name.toLowerCase().includes(q) ||
      a.business_name.toLowerCase().includes(q) ||
      (a.synonyms || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Dicionário Semântico"
        description="Faça a curadoria dos termos, sinônimos e nomes executivos para o LLM."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => openNew()}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg transition shadow-lg shadow-cyan-600/20"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Termo
            </button>
            <button
              onClick={() => loadAliases(selectedTenant)}
              disabled={!selectedTenant || loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1E293B] hover:bg-[#2B3850] text-[#8892A4] hover:text-white font-medium text-xs rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        }
      />

      {/* Tenant Selector & Busca */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white text-sm font-semibold mb-1">Selecionar Tenant</h3>
          <p className="text-[#8892A4] text-xs">O Dicionário é isolado no escopo de cada tenant.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedTenant}
              onChange={e => setSelectedTenant(e.target.value)}
              className="appearance-none bg-[#0B1220] border border-[#1E293B] text-white text-xs rounded-lg pl-3 pr-8 py-2.5 focus:outline-none focus:border-cyan-500 transition cursor-pointer w-full sm:w-64"
            >
              <option value="" disabled>Selecione um tenant...</option>
              {tenants.map(t => {
                const code = t.tenant_code || t.id;
                const name = t.name || t.tenant_name || code;
                return <option key={t.id} value={code}>{code} - {name}</option>;
              })}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4] pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892A4]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por campo, nome ou sinônimo..."
          className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2 text-white text-xs placeholder-[#8892A4]/50 focus:outline-none focus:border-cyan-500 transition"
        />
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
                <th className="px-4 py-3">Campo ERP</th>
                <th className="px-4 py-3">Nome Executivo</th>
                <th className="px-4 py-3">Sinônimos</th>
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
              ) : !selectedTenant ? (
                 <tr>
                   <td colSpan="5" className="text-center py-8 text-slate-500">
                     Selecione um tenant acima para visualizar o dicionário.
                   </td>
                 </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500 flex-col items-center">
                    <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nenhum termo cadastrado. Inicie a curadoria clicando em "Novo Termo".
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="hover:bg-[#1E293B]/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-300">{row.field_name}</td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {row.business_name}
                      {row.field_format && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 uppercase tracking-wider">{row.field_format}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 italic">{row.synonyms || '-'}</td>
                    <td className="px-4 py-3 text-[#8892A4] max-w-xs truncate" title={row.field_description}>{row.field_description || '-'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar/Editar Alias */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#2B3850] bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              {modal.id ? 'Editar Termo Semântico' : 'Novo Termo Semântico'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1.5">Campo ERP de Origem <span className="text-cyan-500">*</span></label>
                <input
                  required
                  value={modal.field_name}
                  onChange={e => setModal({ ...modal, field_name: e.target.value.toUpperCase() })}
                  placeholder="Ex: E1_SALDO"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-xs text-white font-mono uppercase focus:border-cyan-500 outline-none transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1.5">Nome Executivo (Amigável) <span className="text-cyan-500">*</span></label>
                  <input
                    required
                    value={modal.business_name}
                    onChange={e => setModal({ ...modal, business_name: e.target.value })}
                    placeholder="Ex: Saldo em Aberto"
                    className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-xs text-white focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1.5">Sinônimos (separados por vírgula)</label>
                <input
                  value={modal.synonyms}
                  onChange={e => setModal({ ...modal, synonyms: e.target.value })}
                  placeholder="Ex: dívida, montante devedor, a receber"
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-xs text-white focus:border-cyan-500 outline-none transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1.5">Formato Numérico / Visual</label>
                  <select
                    value={modal.field_format}
                    onChange={e => setModal({ ...modal, field_format: e.target.value })}
                    className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-xs text-white focus:border-cyan-500 outline-none transition"
                  >
                    <option value="text">Texto</option>
                    <option value="currency">Moeda (R$)</option>
                    <option value="date">Data (DD/MM/AAAA)</option>
                    <option value="percentage">Percentual (%)</option>
                    <option value="integer">Número Inteiro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1.5">Descrição / Instrução RAG</label>
                <textarea
                  rows="3"
                  value={modal.field_description}
                  onChange={e => setModal({ ...modal, field_description: e.target.value })}
                  placeholder="Instrua o LLM sobre o significado deste campo. Ex: Considerar apenas títulos não vencidos."
                  className="w-full rounded-lg border border-[#263550] bg-[#0B1220] px-3 py-2.5 text-xs text-white focus:border-cyan-500 outline-none transition resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50 transition shadow-lg shadow-cyan-600/20"
                >
                  {saving ? 'Salvando...' : 'Salvar Curadoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
