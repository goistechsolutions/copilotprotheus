#!/bin/bash
# ============================================================
# fix_401_admin.sh — Correção dos 401 no Admin Panel
# Execute: cd /path/to/copilotprotheus/backend && bash fix_401_admin.sh
# ============================================================
set -e

echo "======================================================"
echo " CopilotProtheus — Fix 401 Admin + 502 Companies"
echo "======================================================"

# ── PASSO 1: Diagnóstico das variáveis de ambiente ──────────
echo ""
echo "[1/4] Verificando variáveis críticas de autenticação..."

check_var() {
  local VAR="$1"
  local VAL
  VAL=$(grep "^${VAR}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d "'\"" | xargs)
  if [ -z "$VAL" ]; then
    echo "  ⛔ ${VAR} = VAZIA ou AUSENTE"
    return 1
  elif echo "$VAL" | grep -qiE "(change|secret|dev|default|admin123)"; then
    echo "  ⚠  ${VAR} = VALOR FRACO/PADRÃO detectado"
    return 1
  else
    echo "  ✅ ${VAR} está configurada"
    return 0
  fi
}

NEEDS_FIX=0
check_var "JWT_SECRET"       || NEEDS_FIX=1
check_var "ADMIN_JWT_SECRET" || NEEDS_FIX=1
check_var "ADMIN_USER"       || true
check_var "ADMIN_PASSWORD"   || true

# ── PASSO 2: Sincronizar JWT_SECRET = ADMIN_JWT_SECRET ──────
echo ""
echo "[2/4] Sincronizando JWT_SECRET e ADMIN_JWT_SECRET..."

# Lê o JWT_SECRET atual do .env
CURRENT_JWT=$(grep "^JWT_SECRET=" .env 2>/dev/null | cut -d'=' -f2- | tr -d "'\"" | xargs)
CURRENT_ADMIN_JWT=$(grep "^ADMIN_JWT_SECRET=" .env 2>/dev/null | cut -d'=' -f2- | tr -d "'\"" | xargs)

set_env_var() {
  local KEY="$1"
  local VALUE="$2"
  if grep -q "^${KEY}=" .env 2>/dev/null; then
    sed -i "s|^${KEY}=.*|${KEY}='${VALUE}'|" .env
  else
    echo "${KEY}='${VALUE}'" >> .env
  fi
}

if [ -n "$CURRENT_JWT" ] && [ -z "$CURRENT_ADMIN_JWT" ]; then
  # ADMIN_JWT_SECRET ausente: usa o mesmo JWT_SECRET
  set_env_var "ADMIN_JWT_SECRET" "$CURRENT_JWT"
  echo "  ✅ ADMIN_JWT_SECRET definido igual ao JWT_SECRET"
elif [ -z "$CURRENT_JWT" ] && [ -z "$CURRENT_ADMIN_JWT" ]; then
  # Ambos ausentes: gera novo segredo único
  NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
  set_env_var "JWT_SECRET" "$NEW_SECRET"
  set_env_var "ADMIN_JWT_SECRET" "$NEW_SECRET"
  echo "  ✅ Novo segredo gerado e aplicado em JWT_SECRET e ADMIN_JWT_SECRET"
elif [ "$CURRENT_JWT" != "$CURRENT_ADMIN_JWT" ] && [ -n "$CURRENT_ADMIN_JWT" ]; then
  # Os dois existem mas são diferentes — unifica usando o JWT_SECRET como master
  set_env_var "ADMIN_JWT_SECRET" "$CURRENT_JWT"
  echo "  ✅ ADMIN_JWT_SECRET sincronizado com JWT_SECRET (eram diferentes — causa raiz do 401)"
else
  echo "  ✅ JWT_SECRET e ADMIN_JWT_SECRET já estão iguais. Nenhuma alteração necessária."
fi

# ── PASSO 3: Verificar credenciais REST no banco ─────────────
echo ""
echo "[3/4] Verificando tenant rodol_prd no banco de dados..."

DB_URL=$(grep "^DATABASE_URL=" .env 2>/dev/null | cut -d'=' -f2- | tr -d "'\"" | xargs)

if [ -z "$DB_URL" ]; then
  echo "  ⚠  DATABASE_URL não encontrada no .env — pule esta etapa manualmente."
else
  python3 - <<PYEOF
import os
os.environ["DATABASE_URL"] = """${DB_URL}"""
try:
    from sqlalchemy import create_engine, text
    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as conn:
        # Verifica tenant
        r = conn.execute(text("""
            SELECT id, protheus_rest_url, protheus_user,
                   CASE WHEN encrypted_protheus_password IS NOT NULL
                        AND length(encrypted_protheus_password) > 5
                        THEN 'OK' ELSE 'VAZIA' END as senha_status
            FROM tenants WHERE id = 'rodol_prd'
        """)).fetchone()
        if r:
            print(f"  Tenant rodol_prd encontrado:")
            print(f"    REST URL : {r[1] or '⛔ VAZIA'}")
            print(f"    User     : {r[2] or '⛔ VAZIO'}")
            print(f"    Senha    : {r[3]}")
            if not r[1] or not r[2]:
                print("  ⛔ CAUSA RAIZ DO 401 PROTHEUS: URL ou usuário REST não configurados no tenant!")
        else:
            print("  ⚠ Tenant 'rodol_prd' não encontrado na tabela tenants.")

        # Verifica se há contrato ativo
        c = conn.execute(text("""
            SELECT contract_code, contract_status, starts_at, ends_at
            FROM tenant_contracts WHERE tenant_id='rodol_prd' AND contract_status='active'
            ORDER BY starts_at DESC LIMIT 1
        """)).fetchone()
        if c:
            print(f"  Contrato ativo: {c[0]} | {c[1]} | {c[2]} até {c[3] or 'sem vencimento'}")
        else:
            print("  ⛔ Nenhum contrato ativo para rodol_prd — /schemas e /protheus-modules precisam de contrato!")
except Exception as e:
    print(f"  ⚠ Erro ao conectar no banco: {e}")
PYEOF
fi

# ── PASSO 4: Reiniciar containers ────────────────────────────
echo ""
echo "[4/4] Reiniciando containers backend..."

if command -v docker &> /dev/null; then
  if docker compose ps 2>/dev/null | grep -q "copilot-protheus-backend"; then
    docker compose restart backend
    echo "  ✅ Container 'backend' reiniciado com sucesso."
  elif docker ps 2>/dev/null | grep -q "copilot-protheus-backend"; then
    docker restart copilot-protheus-backend
    echo "  ✅ Container reiniciado via docker restart."
  else
    echo "  ⚠  Container 'copilot-protheus-backend' não encontrado em execução."
    echo "     Execute manualmente: docker compose up -d backend"
  fi
else
  echo "  ⚠  Docker não encontrado. Reinicie o serviço manualmente."
fi

echo ""
echo "======================================================"
echo " ✅ Script concluído!"
echo "======================================================"
echo ""
echo "PRÓXIMOS PASSOS MANUAIS se o 401 persistir:"
echo ""
echo "1. Configure as credenciais REST do tenant 'rodol_prd' no Painel Admin:"
echo "   → Aba Empresas > rodol_prd > protheus_rest_url, protheus_user, senha"
echo ""
echo "2. Para o erro 401 do Protheus Cloud TOTVS:"
echo "   URL: https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest/QueryRest"
echo "   Verifique no Portal TOTVS se o usuário tem permissão de acesso REST."
echo "   O usuário precisa ter acesso ao módulo SIGAADV ou ao REST habilitado."
echo ""
echo "3. Para criar um contrato ativo (se ausente):"
echo "   Execute no banco:"
echo "   INSERT INTO tenant_contracts (id, tenant_id, contract_code, contract_status, starts_at)"
echo "   VALUES (gen_random_uuid(), 'rodol_prd', 'CTR-RODOL-001', 'active', CURRENT_DATE);"
echo ""
echo "4. Para testar a autenticação REST Protheus diretamente:"
echo "   curl -v -u 'SEU_USUARIO:SUA_SENHA' \\"
echo "     'https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest/QueryRest?cQuery=SELECT+1+FROM+DUAL'"
echo ""
