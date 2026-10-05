import os

filepath = 'admin-frontend/src/pages/governance/KnowledgeHealthPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the "Tabelas Faltantes" column with logic to show the DOMAIN_CATALOG_MISMATCH error
replacement = """<td className="px-4 py-3">
                      {item.error === 'DOMAIN_CATALOG_MISMATCH' ? (
                        <div className="text-red-400 text-[11px] bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md inline-block">
                          <span className="font-bold">DOMAIN_CATALOG_MISMATCH</span>
                          <div className="mt-0.5 text-[#8892A4]">Módulo(s) ausente(s) no contrato: {item.missing_modules?.join(', ')}</div>
                        </div>
                      ) : item.missing_tables?.length > 0 ? (
                        <span className="text-red-400 text-[11px] font-mono">
                          {item.missing_tables.join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic text-[11px]">Nenhuma tabela pendente</span>
                      )}
                    </td>"""

content = content.replace("""<td className="px-4 py-3">
                      {item.missing_tables?.length > 0 ? (
                        <span className="text-red-400 text-[11px] font-mono">
                          {item.missing_tables.join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic text-[11px]">Nenhuma tabela pendente</span>
                      )}
                    </td>""", replacement)

with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
