import re

def fix_inline(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove getSafeRows definition
    content = re.sub(r'function getSafeRows.*?return candidateRows.*?}\s*', '', content, flags=re.DOTALL)
    
    # Replace useMemos
    content = re.sub(r'const rows = useMemo\(\(\) => getSafeRows\(result\), \[result\]\);\s*const columns = useMemo\(\(\) => \{.*?\},\s*\[result, rows\]\);',
                     'const rows = Array.isArray(result?.rows) ? result.rows : [];\n  const columns = Array.isArray(result?.columns) && result.columns.length > 0 ? result.columns : (rows.length > 0 ? Object.keys(rows[0]) : []);', content, flags=re.DOTALL)
    
    # Ensure it returns null if no rows
    if 'if (!result || !Array.isArray(result?.rows)' not in content:
        content = content.replace('// Se nao ha linhas (por ex: mensagem simples, erro, ou aguardando), nao exibe os cards', 
                                  'if (!result || !Array.isArray(result.rows)) return null;\n  // Se nao ha linhas (por ex: mensagem simples, erro, ou aguardando), nao exibe os cards')
                                  
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_inline('frontend/src/components/InlineChatDashboard.jsx')
fix_inline('frontend/src/components/StructuredResultPanel.jsx')

def fix_exec(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove getSafeRows definition
    content = re.sub(r'function getSafeRows.*?return candidateRows.*?}\s*', '', content, flags=re.DOTALL)
    
    # Replace calls to getSafeRows
    content = re.sub(r'const rows = useMemo\(\(\) => getSafeRows\(realData\), \[realData\]\);',
                     'const rows = Array.isArray(realData?.result?.rows) ? realData.result.rows : [];', content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_exec('frontend/src/pages/ExecutiveDashboard.jsx')
