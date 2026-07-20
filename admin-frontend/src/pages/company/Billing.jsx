import { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Zap, Server, AlertTriangle } from 'lucide-react';

export default function CompanyBilling({ company }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) {
      fetchBilling(company.id);
    }
  }, [company]);

  const fetchBilling = async (companyId) => {
    try {
      // Usamos a nova rota administrativa (sem admin_key por enquanto ou se precisar configuramos o header)
      const res = await axios.get(`/api/companies/${companyId}/billing`, {
        auth: { username: 'admin', password: 'admin123' }
      });
      setBilling(res.data);
    } catch (error) {
      console.error("Erro ao carregar billing:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!company?.id) return null;

  if (loading) {
    return <div className="p-8 text-slate-500 flex justify-center"><div className="animate-pulse font-medium text-brand-600">Calculando consumo...</div></div>;
  }

  const isOverLimit = billing?.percentage >= 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Zap size={20} className="text-amber-500" />
            <h3 className="font-bold text-sm tracking-widest uppercase">Tokens Usados</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{billing?.current_usage?.toLocaleString('pt-BR')}</p>
          <p className="text-sm text-slate-500 mt-1">Neste mês</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <CreditCard size={20} className="text-emerald-500" />
            <h3 className="font-bold text-sm tracking-widest uppercase">Limite Contratado</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{billing?.limit?.toLocaleString('pt-BR')}</p>
          <p className="text-sm text-slate-500 mt-1">
            Excedente: {billing?.allow_overage ? <span className="text-emerald-600 font-bold">Permitido</span> : <span className="text-red-600 font-bold">Bloqueado</span>}
          </p>
        </div>

        <div className={`p-5 rounded-2xl shadow-sm border ${isOverLimit ? 'bg-red-50 border-red-200' : 'bg-brand-50 border-brand-100'}`}>
          <div className={`flex items-center gap-3 mb-2 ${isOverLimit ? 'text-red-700' : 'text-brand-700'}`}>
            <Server size={20} />
            <h3 className="font-bold text-sm tracking-widest uppercase">Utilização</h3>
          </div>
          <p className={`text-3xl font-bold ${isOverLimit ? 'text-red-800' : 'text-brand-800'}`}>{billing?.percentage}%</p>
          <p className={`text-sm mt-1 ${isOverLimit ? 'text-red-600' : 'text-brand-600'}`}>da franquia consumida</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Progresso de Consumo</h3>
        
        <div className="w-full bg-slate-100 rounded-full h-4 mb-2 overflow-hidden">
          <div 
            className={`h-4 rounded-full transition-all duration-1000 ${isOverLimit ? 'bg-red-500' : billing?.percentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
            style={{ width: `${Math.min(billing?.percentage || 0, 100)}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-sm text-slate-500 font-medium">
          <span>0</span>
          <span>{billing?.current_usage?.toLocaleString('pt-BR')} / {billing?.limit?.toLocaleString('pt-BR')} Tokens</span>
        </div>

        {isOverLimit && !billing?.allow_overage && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold">Limite Excedido</h4>
              <p className="text-sm mt-1">A empresa ultrapassou o limite contratado de tokens e o consumo excedente está bloqueado nas configurações de licença. O serviço de IA do Copilot será interrompido para este Tenant até a virada do ciclo ou alteração do contrato.</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-sm text-slate-600">
        <p><strong>Detalhes de Faturamento:</strong> O cálculo de tokens considera a soma dos <em>prompt_tokens</em> (dados enviados e contexto) e <em>completion_tokens</em> (dados gerados pelo Ollama).</p>
      </div>
    </div>
  );
}
