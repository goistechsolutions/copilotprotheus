import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Database, Building2 } from 'lucide-react';

export default function Tables() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('default');
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchTables(selectedTenant);
    }
  }, [selectedTenant]);

  const fetchTenants = async () => {
    try {
      const res = await axios.get('/api/admin/tenants', axiosConfig);
      setTenants(res.data.tenants || []);
      // If we want to auto-select the first tenant that is not default, we could:
      // if (res.data.tenants && res.data.tenants.length > 0) {
      //   setSelectedTenant(res.data.tenants[0].tenant_id);
      // }
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    }
  };

  const fetchTables = async (tenantId) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin/tables?tenant_id=${tenantId}`, axiosConfig);
      setTables(res.data.tables || []);
    } catch (error) {
      console.error("Erro ao carregar tabelas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/admin/tables', { tables: tables, tenant_id: selectedTenant }, axiosConfig);
      alert("Tabelas atualizadas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar tabelas.");
    } finally {
      setSaving(false);
    }
  };

  const addTable = () => {
    setTables([...tables, { alias: '', description: '', tipo: 'Cadastro', fields: '' }]);
  };

  const removeTable = (index) => {
    const newTables = [...tables];
    newTables.splice(index, 1);
    setTables(newTables);
  };

  const updateTable = (index, field, value) => {
    const newTables = [...tables];
    newTables[index][field] = value;
    setTables(newTables);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Tabelas Permitidas</h2>
          <p className="text-slate-500">Defina quais tabelas do Protheus a IA do Copilot tem permissão para ler por Empresa (Tenant).</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm shrink-0 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? "Salvando..." : "Salvar Configuração"}
        </button>
      </div>

      {/* Tenant Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="bg-brand-50 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
          <Building2 className="text-brand-600" size={24} />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Selecione o Tenant (Empresa):</label>
          <select 
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="w-full sm:w-80 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 transition-all"
          >
            <option value="default">Default (Padrão Global)</option>
            {tenants.map(t => (
              <option key={t.id} value={t.tenant_id}>
                {t.name} ({t.tenant_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="animate-pulse font-medium text-brand-600">Carregando tabelas do Tenant...</div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Tabela / Alias</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Descrição</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Tipo</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Campos Permitidos (separados por vírgula)</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tables.map((t, index) => (
                <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      value={t.alias} 
                      onChange={(e) => updateTable(index, 'alias', e.target.value)}
                      className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none uppercase font-bold text-slate-800 transition-all shadow-sm"
                      placeholder="SF1"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      value={t.description} 
                      onChange={(e) => updateTable(index, 'description', e.target.value)}
                      className="w-full min-w-[200px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm text-slate-800 font-medium"
                      placeholder="Entradas"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={t.tipo} 
                      onChange={(e) => updateTable(index, 'tipo', e.target.value)}
                      className="w-full min-w-[120px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all shadow-sm text-slate-800 font-medium"
                    >
                      <option value="Cabecalho">Cabeçalho</option>
                      <option value="Itens">Itens</option>
                      <option value="Cadastro">Cadastro</option>
                      <option value="Saldo">Saldo</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Contabil">Contábil</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      value={t.fields} 
                      onChange={(e) => updateTable(index, 'fields', e.target.value)}
                      className="w-full min-w-[300px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none uppercase font-mono transition-all shadow-sm text-slate-700"
                      placeholder="F1_DOC, F1_FILIAL..."
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => removeTable(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {tables.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <Database size={48} className="mx-auto text-slate-300 mb-3 opacity-50" />
                    <p className="text-slate-500 font-medium">Nenhuma tabela permitida cadastrada para este Tenant.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button 
            onClick={addTable}
            className="flex items-center gap-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50 font-semibold px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-brand-100"
          >
            <Plus size={18} />
            Adicionar Nova Tabela
          </button>
        </div>
      </div>
    </div>
  );
}
