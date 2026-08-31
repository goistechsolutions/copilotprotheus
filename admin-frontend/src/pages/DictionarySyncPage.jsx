import { useMemo, useState } from 'react';
import { Play, AlertCircle, CheckCircle2, Loader2, Info, Upload, FileText } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

export default function DictionarySyncPage() {
  const [tenantId, setTenantId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [envId, setEnvId] = useState('');
  const [modules, setModules] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [moduleFile, setModuleFile] = useState(null);
  const [importingModules, setImportingModules] = useState(false);
  const [moduleImportResult, setModuleImportResult] = useState(null);
  const [moduleImportError, setModuleImportError] = useState('');

  const payload = useMemo(() => ({
    tenant_id: tenantId.trim(),
    company_id: companyId.trim() || null,
    environment_code: envId.trim(),
    modules: modules
      ? modules.split(',').map(value => value.trim()).filter(Boolean)
      : null,
    async_mode: true,
  }), [tenantId, companyId, envId, modules]);

  const importModules = async () => {
    if (!moduleFile) {
      setModuleImportError('Selecione o arquivo protheus_modules_master.csv.');
      return;
    }
    if (!moduleFile.name.toLowerCase().endsWith('.csv')) {
      setModuleImportError('O arquivo deve ter extensão .csv.');
      return;
    }

    setImportingModules(true);
    setModuleImportError('');
    setModuleImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', moduleFile);
      const { data } = await api.post('/api/admin/protheus-modules/import', formData, {
        // Permite que o navegador defina multipart/form-data com o boundary correto.
        // O cliente Axios possui JSON como padrão para as demais requisições.
        headers: { 'Content-Type': undefined },
      });
      setModuleImportResult(data);
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (detail && typeof detail === 'object') {
        setModuleImportError([detail.message, ...(detail.errors || [])].filter(Boolean).join(' '));
      } else {
        setModuleImportError(detail || e.message || String(e));
      }
    } finally {
      setImportingModules(false);
    }
  };

  const startSync = async () => {
    setLoading(true);
    setError('');
    setStatus(null);
    try {
      const { data } = await api.post('/api/admin/dictionary/snapshot', payload);
      setStatus(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, value, onChange, placeholder, required = false, span }) => (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-[#8892A4] uppercase tracking-wider mb-1.5">
        {label}{required ? ' *' : ''}
      </label>
      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0F1117] border border-[#1E2535] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8892A4]/50 focus:outline-none focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3]/30 transition-all font-mono"
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Sincronizar Dicionário"
        description="Extrai metadados reais do Protheus para o tenant e ambiente informados."
      />

      <div className="bg-[#161B27] border border-[#1E2535] rounded-xl p-6 space-y-6 max-w-3xl">
        <section className="rounded-xl border border-[#2A3850] bg-[#111722] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2196F3]/15 text-[#42A5F5]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Catálogo global de módulos</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-[#AAB4C5]">
                  Importe a relação oficial de código, sigla e descrição para <code className="text-[#7DD3FC]">public.protheus_modules_master</code>.
                  Este arquivo contém somente metadados; não envia dados empresariais ao servidor.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              Somente metadados
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label htmlFor="module-catalog-file" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#8892A4]">
                Arquivo CSV completo
              </label>
              <input
                id="module-catalog-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setModuleFile(event.target.files?.[0] || null);
                  setModuleImportError('');
                  setModuleImportResult(null);
                }}
                className="block w-full cursor-pointer rounded-lg border border-[#2A3850] bg-[#0F1117] text-sm text-[#AAB4C5] file:mr-4 file:border-0 file:bg-[#1D4ED8] file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2196F3]/40"
              />
              <p className="mt-2 text-[11px] text-[#718096]">Cabeçalho obrigatório: <code className="text-[#AAB4C5]">codigo,sigla,descricao</code> · UTF-8 · até 1 MB</p>
            </div>
            <button
              type="button"
              onClick={importModules}
              disabled={importingModules || !moduleFile}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0EA5E9] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0EA5E9]/15 transition hover:bg-[#0284C7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importingModules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importingModules ? 'Importando...' : 'Importar módulos'}
            </button>
          </div>
        </section>

        {moduleImportError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div><p className="text-sm font-medium text-red-400">CSV rejeitado</p><p className="mt-1 text-sm text-red-400/80">{moduleImportError}</p></div>
          </div>
        )}

        {moduleImportResult && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Catálogo importado</p>
              <p className="mt-1 text-sm text-emerald-300/80">{moduleImportResult.modules_imported} módulos ativos em <code>public.protheus_modules_master</code>.</p>
              <p className="mt-1 text-xs text-emerald-300/60">Módulos ausentes no arquivo foram apenas desativados; nenhum registro foi apagado.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Tenant ID"
            value={tenantId}
            onChange={setTenantId}
            placeholder="Código real do tenant"
            required
          />
          <Field
            label="Company ID"
            value={companyId}
            onChange={setCompanyId}
            placeholder="ID da empresa/filial (opcional)"
          />
          <Field
            label="Environment Code (conexão)"
            value={envId}
            onChange={setEnvId}
            placeholder="Código real do ambiente Protheus"
            required
          />
          <Field
            label="Módulos"
            value={modules}
            onChange={setModules}
            placeholder="Ex.: SIGAFAT, SIGAFIN (opcional)"
            span
          />
        </div>

        <div className="pt-4 border-t border-[#1E2535] flex justify-end">
          <button
            disabled={loading || !tenantId.trim() || !envId.trim()}
            onClick={startSync}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#1565C0] to-[#2196F3] hover:from-[#1976D2] hover:to-[#42A5F5] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all shadow-lg shadow-[#1565C0]/20"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando sincronização...</> : <><Play className="w-4 h-4" /> Iniciar sincronização</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 max-w-3xl flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-medium">Falha ao iniciar</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-4 max-w-3xl flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-emerald-400 text-sm font-medium">Sincronização aceita</p>
            <p className="text-[#8892A4] text-sm">Status: <span className="text-white font-mono">{status.status}</span></p>
            <p className="text-[#8892A4] text-sm">Ambiente: <span className="text-white font-mono">{status.environment_code}</span></p>
            <p className="text-[#8892A4]/70 text-xs flex items-center gap-1 mt-1">
              <Info className="w-3.5 h-3.5" /> O progresso deve ser acompanhado nos logs e no catálogo do tenant.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
