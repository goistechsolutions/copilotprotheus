import re

path = 'frontend/src/pages/ExecutiveDashboard.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const dynamicRows = React.useMemo(() => getSafeRows(realData), [realData]);', 'const dynamicRows = React.useMemo(() => Array.isArray(realData?.result?.rows) ? realData.result.rows : [], [realData]);')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
