diff --git a/backend/app/services/module_resolver.py b/backend/app/services/module_resolver.py
new file mode 100644
index 0000000..7777777
--- /dev/null
+++ b/backend/app/services/module_resolver.py
@@ -0,0 +1,58 @@
+"""
+module_resolver.py — Normaliza siglas de módulo (SYS_USR_MODULE)
+para o código usado no dicionário SX2/SX3 (dictionary_tables.module_code).
+
+Problema corrigido: sincronização retornava 400 "Nenhuma tabela
+encontrada" porque a sigla (ex: SIGAEST) não corresponde diretamente
+ao module_code armazenado no snapshot do dicionário.
+"""
+import re
+
+# Mapa de siglas conhecidas -> código de módulo Protheus.
+# Ajustar/expandir conforme o dicionário real do tenant.
+MODULE_ALIAS_MAP = {
+    "SIGAFAT": "05",
+    "SIGAFIN": "06",
+    "SIGACOM": "02",
+    "SIGAEST": "04",
+    "SIGACTB": "07",
+    "SIGAFIS": "12",
+    "SIGAPCP": "03",
+    "SIGAGPE": "27",
+}
+
+
+def normalize_module_token(raw: str) -> str:
+    """Remove espaços e padroniza para upper-case."""
+    return re.sub(r"\s+", "", raw or "").strip().upper()
+
+
+def resolve_module_codes(selected_modules: list[str]) -> list[str]:
+    """
+    Recebe as siglas selecionadas na UI (ex: ['SIGAEST'])
+    e retorna todos os identificadores possíveis para busca
+    tolerante no dicionário: a própria sigla, o código mapeado
+    e variações comuns.
+    """
+    resolved: set[str] = set()
+
+    for raw in selected_modules:
+        token = normalize_module_token(raw)
+        if not token:
+            continue
+
+        resolved.add(token)                      # ex: SIGAEST
+
+        code = MODULE_ALIAS_MAP.get(token)
+        if code:
+            resolved.add(code)                   # ex: 04
+
+        # tolera módulo já vindo como código numérico
+        if token.isdigit():
+            resolved.add(token)
+
+    return list(resolved)
