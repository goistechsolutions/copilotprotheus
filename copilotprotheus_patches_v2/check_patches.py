from pathlib import Path
import re,sys
r=Path(sys.argv[1] if len(sys.argv)>1 else '.');h=Path(__file__).parent;e=[]
for p in h.glob('000*.patch'):
 for x in re.findall(r'^\+\+\+ b/(.+)$',p.read_text(),re.M):
  if (r/x).exists():e.append(x)
print('colisões: '+', '.join(e) if e else 'OK: sem colisões');raise SystemExit(bool(e))
