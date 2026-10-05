import re

with open('backend/app/api/business_governance_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """@router.get("/health")
def get_business_knowledge_health(
    tenant_id: str,
    db: Session = Depends(get_db),
    admin: str = Depends(require_admin),
):
    try:
        from app.models.business_knowledge import BusinessDomainModule
        clean_tenant = resolve_clean_tenant(db, tenant_id)
        ensure_tenant_tables(db, clean_tenant)
        
        intents = db.query(BusinessIntent, BusinessDomain).join(
            BusinessDomain, BusinessIntent.domain_code == BusinessDomain.domain_code
        ).filter(BusinessIntent.active == True).all()
        
        intent_tables = db.query(BusinessIntentTable).all()
        req_tables_by_intent: Dict[int, List[str]] = {}
        for it in intent_tables:
            req_tables_by_intent.setdefault(it.intent_id, []).append(it.table_code.upper())
            
        synced_rows = db.execute(text(f\"\"\"
            SELECT DISTINCT UPPER(table_code) AS table_code
            FROM "{clean_tenant}".dictionary_tables
            WHERE active_flag = TRUE
        \"\"\")).scalars().all()
        synced_tables = set(synced_rows)
        
        domain_modules = db.query(BusinessDomainModule).all()
        req_modules_by_domain: Dict[str, List[int]] = {}
        for dm in domain_modules:
            req_modules_by_domain.setdefault(dm.domain_code, []).append(dm.module_id)
            
        enabled_modules_rows = db.execute(text(f\"\"\"
            SELECT module_id FROM "{clean_tenant}".tenant_modules WHERE enabled = TRUE
        \"\"\")).mappings().all()
        enabled_modules = {int(r["module_id"]) for r in enabled_modules_rows if r.get("module_id") is not None}
        
        health_report = []
        for intent, domain in intents:
            required = req_tables_by_intent.get(intent.id, [])
            missing = [t for t in required if t not in synced_tables]
            present = [t for t in required if t in synced_tables]
            
            domain_req_modules = req_modules_by_domain.get(domain.domain_code, [])
            missing_modules = [m for m in domain_req_modules if m not in enabled_modules]
            
            error_code = None
            if missing_modules:
                status_calc = "critical"
                error_code = "DOMAIN_CATALOG_MISMATCH"
            elif not required:
                status_calc = "healthy"
            elif not missing:
                status_calc = "healthy"
            elif len(missing) < len(required):
                status_calc = "warning"
            else:
                status_calc = "critical"
                
            health_report.append({
                "intent_code": intent.intent_code,
                "intent_name": intent.name,
                "domain_code": domain.domain_code,
                "domain_name": domain.name,
                "status": status_calc,
                "error": error_code,
                "missing_modules": missing_modules,
                "required_tables": required,
                "synced_tables": present,
                "missing_tables": missing,
                "coverage_pct": 0.0 if error_code else (round(len(present) / len(required) * 100, 1) if required else 100.0),
            })
            
        total_healthy = sum(1 for h in health_report if h["status"] == "healthy")
        total_warning = sum(1 for h in health_report if h["status"] == "warning")
        total_critical = sum(1 for h in health_report if h["status"] == "critical")
        
        return {
            "tenant_id": tenant_id,
            "overall_status": "critical" if total_critical > 0 else ("warning" if total_warning > 0 else "healthy"),
            "summary": {
                "total_intents": len(health_report),
                "healthy": total_healthy,
                "warning": total_warning,
                "critical": total_critical,
            },
            "intents": health_report
        }
    except Exception as e:
        logger.error(f"Erro no knowledge health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
"""

content = re.sub(r'@router\.get\("/health"\).*?raise HTTPException\(status_code=500, detail=str\(e\)\)', replacement, content, flags=re.DOTALL)

with open('backend/app/api/business_governance_routes.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Updated /health")
