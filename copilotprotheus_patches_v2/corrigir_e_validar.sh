#!/usr/bin/env bash
set -euo pipefail
PATCH_FILE="0001-backend.patch"
cp "$PATCH_FILE" "$PATCH_FILE.bak"
python3 - <<'PY'
from pathlib import Path
p=Path('0001-backend.patch')
t=p.read_text()
t=t.replace('@@ -0,0 +1,0 @@
','@@ -0,0 +1 @@
+# Copilot v2 package.
',1)
p.write_text(t)
print('Patch corrigido')
PY
for p in 000*.patch; do
 patch --dry-run -p1 < "$p"
done
echo OK
