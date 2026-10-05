import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """@app.get("/api/admin/dashboard/stats")
async def dashboard_stats(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    \"\"\"Metricas gerais do painel admin EliteCorp\"\"\"
    tenants = 0
    users = 0
    rag_docs = 0
    conversations = 0
    activity_by_module = []
    recent_actions = []

    try:
        tenants = db.execute(text("SELECT COUNT(*) FROM public.tenants WHERE status = 'ACTIVE'")).scalar() or 0
    except Exception as e:
        logger.warning(f"Erro ao contar tenants: {e}")
        db.rollback()

    try:
        users = db.execute(text("SELECT COUNT(*) FROM public.users")).scalar() or 0
    except Exception as e:
        logger.warning(f"Erro ao contar users: {e}")
        db.rollback()

    uptime_seconds = time.time() - APP_START_TIME
    uptime_str = f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m"

    return {
        "tenants": tenants,
        "users": users,
        "rag_documents": rag_docs,
        "conversations_today": conversations,
        "avg_response_ms": None,
        "uptime": uptime_str,
        "activity_by_module": activity_by_module,
        "recent_actions": recent_actions,
    }
"""

content = re.sub(r'@app\.get\("/api/admin/dashboard/stats"\).*?return \{.*?"recent_actions": recent_actions,\n    \}', replacement, content, flags=re.DOTALL)

with open('backend/app/main.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed dashboard stats")
