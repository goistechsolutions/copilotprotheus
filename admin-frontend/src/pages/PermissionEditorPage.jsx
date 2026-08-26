import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Database, Eye, Filter, LockKeyhole, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

function listFrom(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function Toggle({ checked, onChange, label }) {
  return <button type="button" aria-pressed={checked} aria-label={`${label}: ${checked ? 'permitido' : 'bloqueado'}`} onClick={onChange} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? 'bg-[#2563EB]' : 'bg-[#334155]'}`}><span className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} /></button>;
}

function ScopeBadge({ value }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${value ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-slate-600/40 bg-slate-800/60 text-[#94A3B8]'}`}>{value ? 'Permitido' : 'Bloqueado'}</span>;
}

export default function PermissionEditorPage() {
  const [tenants, setTenants] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [tables, setTables] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [fieldPermissions, setFieldPermissions] = useState({});
  const [expandedTable, setExpandedTable] = useState('');
  const [search, setSearch] = useState('');
  const [loadingScope, setLoadingScope] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [savingTable, setSavingTable] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadScope = async () => {
    setLoadingScope(true);
    setError('');
    try {
      const [tenantResponse, roleResponse] = await Promise.all([api.get('/api/tenants'), api.get('/api/admin/roles')]);
      const tenantList = listFrom(tenantResponse.data, ['tenants', 'items']);
      const roleList = listFrom(roleResponse.data, ['roles', 'items']);
      setTenants(tenantList);
      setRoles(roleList);
      if (tenantList.length === 1) {
        const onlyTenant = tenantList[0];
        setSelectedTenant(String(onlyTenant.tenant_code || onlyTenant.id || ''));
        setEnvironmentId(String(onlyTenant.connection?.environment_code || ''));
      }
      if (roleList.length === 1) setSelectedRole(String(roleList[0].id || roleList[0].role_code || ''));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível carregar tenants e perfis para o editor.');
    } finally {
      setLoadingScope(false);
    }
  };

  const loadTablesAndPermissions = async () => {
    if (!selectedTenant || !environmentId.trim() || !selectedRole) {
      setTables([]);
      setPermissions({});
      setFieldPermissions({});
      return;
    }
    setLoadingTables(true);
    setError('');
    setNotice('');
    try {
      const query = `tenant_id=${encodeURIComponent(selectedTenant)}&environment_id=${encodeURIComponent(environmentId.trim())}&role_id=${encodeURIComponent(selectedRole)}`;
      const [catalogResponse, permissionResponse] = await Promise.all([
        api.get(`/api/admin/dictionary/tables?tenant_id=${encodeURIComponent(selectedTenant)}`),
        api.get(`/api/admin/permissions?${query}`),
      ]);
      const catalog = listFrom(catalogResponse.data?.tables || catalogResponse.data, ['tables', 'items']);
      const saved = permissionResponse.data || {};
      setTables(catalog);
      if (saved.status === 'unavailable') setNotice(saved.message || 'A matriz de permissões ainda não está disponível para este tenant.');
      const tableMap = {};
      listFrom(saved, ['tables', 'permissions']).forEach(permission => {
        const key = String(permission.table_name || '').toUpperCase();
        if (key) tableMap[key] = { can_list: Boolean(permission.can_list), can_describe: Boolean(permission.can_describe), can_query: Boolean(permission.can_query), company_id: permission.company_id || null };
      });
      const fieldMap = {};
      listFrom(saved, ['fields']).forEach(permission => {
        const tableKey = String(permission.table_name || '').toUpperCase();
        const fieldKey = String(permission.field_name || '').toUpperCase();
        if (tableKey && fieldKey) fieldMap[`${tableKey}:${fieldKey}`] = { can_select: Boolean(permission.can_select), can_filter: Boolean(permission.can_filter), masked_flag: Boolean(permission.masked_flag) };
      });
      setPermissions(tableMap);
      setFieldPermissions(fieldMap);
    } catch (requestError) {
      setTables([]);
      setPermissions({});
      setFieldPermissions({});
      setError(requestError.response?.data?.detail || 'Não foi possível carregar o catálogo ou a matriz de permissões.');
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => { loadScope(); }, []);
  useEffect(() => { loadTablesAndPermissions(); }, [selectedTenant, environmentId, selectedRole]);

  const handleTenantChange = value => {
    setSelectedTenant(value);
    const tenant = tenants.find(item => String(item.tenant_code || item.id) === value);
    setEnvironmentId(String(tenant?.connection?.environment_code || ''));
    setExpandedTable('');
  };

  const tableKey = table => String(table.tabela || table.table_name || table.chave || '').toUpperCase();
  const fieldKey = (table, field) => `${tableKey(table)}:${String(field.campo || field.field_name || '').toUpperCase()}`;
  const isTableAllowed = table => permissions[tableKey(table)]?.can_query === true;

  const filteredTables = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tables;
    return tables.filter(table => `${table.tabela || ''} ${table.chave || ''} ${table.nome || ''} ${table.mod_sigla || ''}`.toLowerCase().includes(term));
  }, [search, tables]);

  const updateTablePermission = (table, key) => {
    const name = tableKey(table);
    setPermissions(previous => ({ ...previous, [name]: { can_list: previous[name]?.can_list || false, can_describe: previous[name]?.can_describe || false, can_query: previous[name]?.can_query || false, [key]: !previous[name]?.[key] } }));
  };

  const updateFieldPermission = (table, field, key) => {
    const name = fieldKey(table, field);
    setFieldPermissions(previous => ({ ...previous, [name]: { can_select: previous[name]?.can_select || false, can_filter: previous[name]?.can_filter || false, masked_flag: previous[name]?.masked_flag || false, [key]: !previous[name]?.[key] } }));
  };

  const saveTable = async table => {
    const name = tableKey(table);
    if (!name || !selectedTenant || !environmentId.trim() || !selectedRole) return;
    setSavingTable(name);
    setError('');
    setNotice('');
    const tablePermission = permissions[name] || {};
    const fields = Array.isArray(table.campos) ? table.campos.map(field => {
      const current = fieldPermissions[fieldKey(table, field)] || {};
      return { field_name: String(field.campo || field.field_name || '').toUpperCase(), can_select: current.can_select === true, can_filter: current.can_filter === true, masked_flag: current.masked_flag === true };
    }).filter(field => field.field_name);
    try {
      await api.post('/api/admin/permissions', { tenant_id: selectedTenant, environment_id: environmentId.trim(), role_id: selectedRole, table_name: name, can_list: tablePermission.can_list === true, can_describe: tablePermission.can_describe === true, can_query: tablePermission.can_query === true, field_permissions: fields });
      setNotice(`Permissões da tabela ${name} salvas para o perfil selecionado.`);
      await loadTablesAndPermissions();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Não foi possível salvar as permissões desta tabela.');
    } finally {
      setSavingTable('');
    }
  };

  const canEdit = Boolean(selectedTenant && environmentId.trim() && selectedRole);
  const selectedTenantLabel = tenants.find(tenant => String(tenant.tenant_code || tenant.id) === selectedTenant)?.tenant_name || selectedTenant;
  const selectedRoleLabel = roles.find(role => String(role.id || role.role_code) === selectedRole)?.role_name || selectedRole;

  return (
    <div className="space-y-6">
      <PageHeader title="Permissões do catálogo" description="Controle o acesso a tabelas e campos por tenant, ambiente e perfil, sem ampliar o escopo do agente." actions={<button type="button" onClick={loadTablesAndPermissions} disabled={!canEdit || loadingTables} className="inline-flex items-center gap-2 rounded-lg border border-[#2B3850] bg-[#161B27] px-3.5 py-2 text-sm font-medium text-[#CBD5E1] transition hover:border-[#60A5FA]/60 hover:bg-[#1E293B] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loadingTables ? 'animate-spin' : ''}`} />Atualizar</button>} />

      <section className="rounded-2xl border border-[#2B3850] bg-gradient-to-br from-[#172554] via-[#161B27] to-[#111827] p-5">
        <div className="mb-4 flex items-center gap-2 text-[#93C5FD]"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Escopo obrigatório</span></div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Tenant</span><select value={selectedTenant} onChange={event => handleTenantChange(event.target.value)} disabled={loadingScope} className="w-full rounded-lg border border-[#334155] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA] disabled:opacity-60"><option value="">{loadingScope ? 'Carregando…' : 'Selecione um tenant'}</option>{tenants.map(tenant => { const value = String(tenant.tenant_code || tenant.id || ''); return <option key={value} value={value}>{tenant.tenant_name || tenant.name || value}</option>; })}</select></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Ambiente Protheus</span><input value={environmentId} onChange={event => setEnvironmentId(event.target.value)} placeholder="Código real do ambiente" className="w-full rounded-lg border border-[#334155] bg-[#0B1220] px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-[#64748B] focus:border-[#60A5FA]" /><span className="mt-1 block text-[10px] text-[#64748B]">Nunca use “default” ou um ambiente estimado.</span></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#CBD5E1]">Perfil</span><select value={selectedRole} onChange={event => setSelectedRole(event.target.value)} disabled={loadingScope} className="w-full rounded-lg border border-[#334155] bg-[#0B1220] px-3 py-2.5 text-sm text-white outline-none focus:border-[#60A5FA] disabled:opacity-60"><option value="">{loadingScope ? 'Carregando…' : 'Selecione um perfil'}</option>{roles.map(role => { const value = String(role.id || role.role_code || ''); return <option key={value} value={value}>{role.role_name || role.role_code || value}</option>; })}</select></label>
        </div>
        {canEdit && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]"><span className="rounded-full border border-[#334155] bg-[#0B1220] px-2.5 py-1">Tenant: <strong className="text-white">{selectedTenantLabel}</strong></span><span className="rounded-full border border-[#334155] bg-[#0B1220] px-2.5 py-1">Perfil: <strong className="text-white">{selectedRoleLabel}</strong></span><span className="rounded-full border border-[#334155] bg-[#0B1220] px-2.5 py-1">Ambiente: <strong className="font-mono text-white">{environmentId}</strong></span></div>}
      </section>

      {error && <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {notice && <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>}

      {!canEdit ? <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#2B3850] bg-[#111827]/60 px-6 text-center"><LockKeyhole className="mb-3 h-9 w-9 text-[#334155]" /><h2 className="text-sm font-semibold text-white">Selecione o escopo de autorização</h2><p className="mt-1 max-w-lg text-xs leading-5 text-[#94A3B8]">Informe tenant, ambiente Protheus e perfil para consultar ou editar a matriz. Nenhuma permissão é assumida automaticamente.</p></div> : <section className="overflow-hidden rounded-2xl border border-[#1E2A3D] bg-[#161B27]">
        <div className="flex flex-col gap-3 border-b border-[#1E2A3D] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#60A5FA]" /><div><h2 className="text-sm font-semibold text-white">Tabelas autorizáveis</h2><p className="text-[10px] text-[#64748B]">{loadingTables ? 'Consultando catálogo…' : `${filteredTables.length} de ${tables.length} tabelas do snapshot`}</p></div></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar tabela ou módulo…" className="w-full rounded-lg border border-[#263550] bg-[#0B1220] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#64748B] focus:border-[#60A5FA]" /></div></div>
        {loadingTables ? <div className="flex min-h-56 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-[#60A5FA]" /></div> : filteredTables.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><Database className="mb-3 h-9 w-9 text-[#334155]" /><h2 className="text-sm font-semibold text-white">Nenhuma tabela disponível</h2><p className="mt-1 max-w-md text-xs leading-5 text-[#94A3B8]">O catálogo pode estar vazio, indisponível ou não possuir tabelas que correspondam à busca. Nenhuma tabela foi inventada.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-[#1E2A3D] bg-[#111827]/70"><tr>{['Tabela', 'Módulo', 'Descrição', 'Consulta', 'Campos', 'Ação'].map(header => <th key={header} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#1E2A3D]">{filteredTables.map(table => { const name = tableKey(table); const permission = permissions[name] || {}; const expanded = expandedTable === name; return <Fragment key={name}>
          <tr key={`${name}-row`} className="transition hover:bg-[#1E2535]/40"><td className="px-5 py-3"><div className="font-mono text-xs font-semibold text-white">{table.tabela || table.chave || '—'}</div><div className="mt-0.5 font-mono text-[10px] text-[#64748B]">{table.chave || 'chave não informada'}</div></td><td className="px-5 py-3 text-xs text-[#CBD5E1]">{table.mod_sigla || '—'}</td><td className="max-w-[260px] truncate px-5 py-3 text-xs text-[#94A3B8]">{table.nome || 'Descrição não informada'}</td><td className="px-5 py-3"><div className="flex items-center gap-2"><Toggle checked={isTableAllowed(table)} onChange={() => updateTablePermission(table, 'can_query')} label={`Consulta ${name}`} /><ScopeBadge value={isTableAllowed(table)} /></div></td><td className="px-5 py-3 text-xs text-[#94A3B8]">{Array.isArray(table.campos) ? table.campos.length : table.total_campos || 0}</td><td className="px-5 py-3"><div className="flex items-center gap-1.5"><button type="button" onClick={() => setExpandedTable(expanded ? '' : name)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2B3850] bg-[#111827] px-2.5 py-1.5 text-xs text-[#CBD5E1] transition hover:border-[#60A5FA]/50 hover:text-white"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />Campos</button><button type="button" onClick={() => saveTable(table)} disabled={savingTable === name} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50">{savingTable === name ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar</button></div></td></tr>
          {expanded && <tr key={`${name}-fields`}><td colSpan={6} className="bg-[#0F172A]/80 px-5 py-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold text-white">Permissões de campos — {name}</h3><p className="mt-1 text-[10px] text-[#64748B]">Seleção, filtro e mascaramento são independentes. O agente não cria JOINs a partir de X3_RELACAO.</p></div><div className="flex items-center gap-3 text-[10px] text-[#94A3B8]"><span className="flex items-center gap-1"><Eye className="h-3 w-3" />seleção</span><span className="flex items-center gap-1"><Filter className="h-3 w-3" />filtro</span><span className="flex items-center gap-1"><LockKeyhole className="h-3 w-3" />máscara</span></div></div>{Array.isArray(table.campos) && table.campos.length > 0 ? <div className="grid gap-2 md:grid-cols-2">{table.campos.map(field => { const current = fieldPermissions[fieldKey(table, field)] || {}; return <div key={fieldKey(table, field)} className="flex items-center justify-between gap-3 rounded-lg border border-[#1E2A3D] bg-[#111827] px-3 py-2.5"><div className="min-w-0"><div className="truncate font-mono text-xs text-white">{field.campo || field.field_name}</div><div className="truncate text-[10px] text-[#64748B]">{field.descricao || 'Sem descrição informada'}</div></div><div className="flex shrink-0 items-center gap-3"><Toggle checked={current.can_select === true} onChange={() => updateFieldPermission(table, field, 'can_select')} label={`Seleção ${field.campo || field.field_name}`} /><Toggle checked={current.can_filter === true} onChange={() => updateFieldPermission(table, field, 'can_filter')} label={`Filtro ${field.campo || field.field_name}`} /><Toggle checked={current.masked_flag === true} onChange={() => updateFieldPermission(table, field, 'masked_flag')} label={`Máscara ${field.campo || field.field_name}`} /></div></div>; })}</div> : <p className="text-xs text-[#94A3B8]">O snapshot não retornou campos para esta tabela.</p>}</td></tr>}
        </Fragment>; })}</tbody></table></div>}
      </section>}
    </div>
  );
}
