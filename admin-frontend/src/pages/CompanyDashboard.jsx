import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Building2, 
  Settings, 
  Database, 
  Users, 
  CreditCard, 
  Activity, 
  ChevronLeft 
} from 'lucide-react';

// Placeholder components for the sub-routes
function CompanyConfig({ company }) {
  return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200"><h3 className="font-bold mb-4">Configurações Gerais</h3><p>Edite os dados de {company?.razao_social}</p></div>;
}

import CompanyDictionary from './company/Dictionary';
import CompanyBilling from './company/Billing';
import CompanyUsers from './company/Users';

function CompanyHealth({ company }) {
  return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200"><h3 className="font-bold mb-4">Logs & Disponibilidade</h3><p>Status do Protheus REST URL: {company?.protheus_rest_url}</p></div>;
}

export default function CompanyDashboard() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanyData();
  }, [id]);

  const fetchCompanyData = async () => {
    try {
      // Temporary logic: fetch all companies and find this one.
      // Ideally, add a GET /api/companies/:id endpoint in the backend.
      const res = await axios.get('/api/companies');
      const found = res.data.find(c => String(c.id) === String(id));
      setCompany(found);
    } catch (error) {
      console.error("Erro ao carregar empresa:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { path: '', label: 'Geral', icon: <Settings size={18} /> },
    { path: '/dictionary', label: 'Dicionário (Tabelas)', icon: <Database size={18} /> },
    { path: '/users', label: 'Usuários', icon: <Users size={18} /> },
    { path: '/billing', label: 'Recursos & Custos', icon: <CreditCard size={18} /> },
    { path: '/health', label: 'Logs & Protheus', icon: <Activity size={18} /> }
  ];

  if (loading) return <div className="animate-pulse p-8 text-brand-600 font-medium">Carregando dashboard da empresa...</div>;
  if (!company) return <div className="p-8 text-red-600 font-medium">Empresa não encontrada!</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <button 
          onClick={() => navigate('/companies')}
          className="flex items-center gap-1 text-slate-500 hover:text-brand-600 font-medium text-sm mb-4 transition-colors"
        >
          <ChevronLeft size={16} /> Voltar para Lista de Empresas
        </button>
        <div className="flex items-center gap-4">
          <div className="bg-brand-50 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0">
            <Building2 className="text-brand-600" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{company.razao_social}</h2>
            <div className="flex gap-3 text-sm text-slate-500 mt-1">
              <span>CNPJ: {company.cnpj || 'Não informado'}</span>
              <span>•</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono text-xs">Tenant: {company.tenant_id || company.protheus_grupo || 'N/A'}</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${company.status === 'ativa' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {company.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex overflow-x-auto custom-scrollbar">
        {tabs.map(tab => {
          const fullPath = `/companies/${id}${tab.path}`;
          const isActive = location.pathname === fullPath || (tab.path === '' && location.pathname === `/companies/${id}`);
          
          return (
            <Link
              key={tab.path}
              to={fullPath}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                isActive 
                  ? 'bg-brand-50 text-brand-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Content Router */}
      <div className="min-h-[400px]">
        <Routes>
          <Route path="/" element={<CompanyConfig company={company} />} />
          <Route path="/dictionary" element={<CompanyDictionary company={company} />} />
          <Route path="/users" element={<CompanyUsers company={company} />} />
          <Route path="/billing" element={<CompanyBilling company={company} />} />
          <Route path="/health" element={<CompanyHealth company={company} />} />
        </Routes>
      </div>
    </div>
  );
}
