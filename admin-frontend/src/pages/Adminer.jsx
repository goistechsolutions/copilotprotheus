import { Database, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

export default function Adminer() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Banco de Dados"
        description="Acesso operacional ao PostgreSQL por meio do proxy administrativo protegido."
        actions={
          <a
            href="/adminer/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2B3850] bg-[#161B27] px-3.5 py-2 text-sm font-medium text-[#CBD5E1] transition hover:border-[#60A5FA]/60 hover:bg-[#1E293B] hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir em nova aba
          </a>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#1E2A3D] bg-[#161B27] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]/15 text-[#60A5FA]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold text-white">Sessão administrativa</h2>
          <p className="mt-1 text-xs leading-5 text-[#94A3B8]">A entrada nesta área continua condicionada ao JWT administrativo do painel.</p>
        </div>
        <div className="rounded-xl border border-[#1E2A3D] bg-[#161B27] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <LockKeyhole className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold text-white">Sem credenciais na interface</h2>
          <p className="mt-1 text-xs leading-5 text-[#94A3B8]">A conexão não é montada em URL, não é gravada no bundle e não é exibida no painel.</p>
        </div>
        <div className="rounded-xl border border-[#1E2A3D] bg-[#161B27] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Database className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold text-white">Uso restrito</h2>
          <p className="mt-1 text-xs leading-5 text-[#94A3B8]">Utilize esta área apenas para diagnóstico e manutenção autorizada. Não altere dados corporativos sem procedimento aprovado.</p>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        <p>O Adminer pode solicitar autenticação própria do banco. Nunca cole senhas ou tokens em chamados, logs ou no código do projeto.</p>
      </div>

      <section className="relative min-h-[560px] overflow-hidden rounded-2xl border border-[#1E2A3D] bg-[#0F1522] shadow-2xl shadow-black/20">
        <iframe
          src="/adminer/"
          className="absolute inset-0 h-full w-full border-0"
          title="Adminer — acesso protegido ao PostgreSQL"
        />
      </section>
    </div>
  );
}
