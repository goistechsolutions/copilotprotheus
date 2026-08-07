diff --git a/app/services/module_sync_resolver.py b/app/services/module_sync_resolver.py
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/app/services/module_sync_resolver.py
@@ -0,0 +1,74 @@
+"""
+Resolver de módulos para sincronização do dicionário por tenant.
+
+Regra crítica:
+- UI pode enviar sigla (ex: SIGAEST)
+- persistência e JOIN do tenant usam código numérico (ex: 04)
+- nunca usar sigla como chave final de vínculo com tenant_schemas
+"""
+from sqlalchemy import text
+from fastapi import HTTPException
+
+
+def resolve_modules_to_numeric_codes(db, tenant_schema: str, selected_modules: list[str]) -> list[str]:
+    if not selected_modules:
+        raise HTTPException(status_code=400, detail="Selecione ao menos um módulo.")
+
+    normalized = [m.strip().upper() for m in selected_modules if m and m.strip()]
+    if not normalized:
+        raise HTTPException(status_code=400, detail="Lista de módulos inválida.")
+
+    sql = text(f'''
+        SELECT DISTINCT
+            CAST(modulo AS VARCHAR) AS modulo,
+            UPPER(TRIM(codmod)) AS codmod
+        FROM "{tenant_schema}".protheus_modules
+        WHERE
+            CAST(modulo AS VARCHAR) = ANY(:mods)
+            OR UPPER(TRIM(codmod)) = ANY(:mods)
+    ''')
+
+    rows = db.execute(sql, {"mods": normalized}).fetchall()
+
+    if not rows:
+        raise HTTPException(
+            status_code=400,
+            detail=(
+                "Nenhum módulo válido encontrado no tenant para a seleção informada: "
+                + ", ".join(normalized)
+            ),
+        )
+
+    modulo_codes = sorted({str(r.modulo).strip() for r in rows if r.modulo is not None})
+
+    if not modulo_codes:
+        raise HTTPException(
+            status_code=400,
+            detail="Os módulos selecionados não possuem código numérico válido."
+        )
+
+    return modulo_codes
