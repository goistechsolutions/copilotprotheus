import { useState, useEffect } from 'react';
import api from '../api/axios';
import { ShieldCheck, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function QueryGuardPage() {
  const [rules, setRules]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/api/admin/query-guard/rules');
      setRules(data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao carregar regras');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const testGuard = async () => {
    if (!testQuery.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      const { data } = await api.post('/api/admin/query-guard/test', { query: testQuery });
      setTestResult(data);
    } catch (e) {
      setTestResult({ allowed: false, reason: e.response?.data?.detail || 'Erro no teste' });
    }
    setTesting(false);
  };

  return (
    <div>
      <PageHeader
        title="Query Guard"
        description="Regras de validação e bloqueio de queries SQL geradas pelo agente."
        action={<button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-[#1E2535] hover:bg-[#2196F3]/20 border border-[#1E2535] hover:border-[#2196F3]/40 text-[#8892A4] hover:text-white text-sm rounded-lg transition-all"><RefreshCw className="w-4 h-4" />Atualizar</button>}
      />

      {/* Tester */}
      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-5 mb-5">
        <p className="text-[#8892A4] text-xs uppercase font-semibold tracking-wider mb-3">Testar uma Query</p>
        <div className="flex gap-3">
          <input
            value={testQuery} onChange={e => setTestQuery(e.target.value)}
            placeholder="SELECT * FROM SA1010 WHERE ..."
            className="flex-1 bg-[#0F1117] border border-[#1E2535] rounded-lg px-4 py-2.5 text-white text-sm font-mono placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] transition-all"
          />
          <button onClick={testGuard} disabled={testing || !testQuery.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1565C0] hover:bg-[#1976D2] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all">
            <ShieldCheck className="w-4 h-4" />
            {testing ? 'Testando...' : 'Testar'}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 text-sm rounded-lg px-4 py-3 border ${
            testResult.allowed
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {testResult.allowed ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            <div>
              <p className="font-semibold">{testResult.allowed ? 'Query Permitida' : 'Query Bloqueada'}</p>
              {testResult.reason && <p className="text-xs mt-0.5 opacity-80">{testResult.reason}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Regras */}
      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E2535] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2196F3]" />
          <span className="text-white text-sm font-semibold">Regras Ativas ({rules.length})</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm px-5 py-10">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16 text-[#8892A4]">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma regra configurada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#1E2535]">
              <tr>
                {['Tipo','Padrão / Regra','Descrição','Ação'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-[#8892A4] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2535]">
              {rules.map((r, i) => (
                <tr key={i} className="hover:bg-[#1E2535]/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-xs bg-[#0F1117] border border-[#1E2535] text-[#8892A4] px-2 py-0.5 rounded font-mono">{r.type || r.rule_type}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-white text-xs">{r.pattern || r.value}</td>
                  <td className="px-5 py-3 text-[#8892A4] text-xs">{r.description || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      r.action === 'block'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>{r.action || 'warn'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
