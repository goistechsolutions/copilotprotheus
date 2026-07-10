import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save } from 'lucide-react';

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const axiosConfig = {
    auth: { username: 'admin', password: 'admin123' }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await axios.get('/api/admin/tables', axiosConfig);
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
      await axios.post('/api/admin/tables', tables, axiosConfig);
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

  if (loading) return <div className="p-8 text-slate-500">Carregando tabelas...</div>;

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Tabelas Permitidas</h2>
          <p className="text-slate-500">Defina quais tabelas do Protheus a IA do Copilot tem permissão para ler.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all"
        >
          <Save size={18} />
          {saving ? "Salvando..." : "Salvar Configuração"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Tabela / Alias</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Descrição</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Tipo</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Campos (separados por vírgula)</th>
              <th className="p-4 font-semibold text-slate-600 text-sm w-16 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t, index) => (
              <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <input 
                    type="text" 
                    value={t.alias} 
                    onChange={(e) => updateTable(index, 'alias', e.target.value)}
                    className="w-24 px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    placeholder="SF1"
                  />
                </td>
                <td className="p-4">
                  <input 
                    type="text" 
                    value={t.description} 
                    onChange={(e) => updateTable(index, 'description', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Entradas"
                  />
                </td>
                <td className="p-4">
                  <select 
                    value={t.tipo} 
                    onChange={(e) => updateTable(index, 'tipo', e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
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
                <td className="p-4">
                  <input 
                    type="text" 
                    value={t.fields} 
                    onChange={(e) => updateTable(index, 'fields', e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono text-xs"
                    placeholder="F1_DOC, F1_FILIAL..."
                  />
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => removeTable(index)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button 
            onClick={addTable}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded"
          >
            <Plus size={18} />
            Adicionar Nova Tabela
          </button>
        </div>
      </div>
    </div>
  );
}
