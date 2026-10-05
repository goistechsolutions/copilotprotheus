import re

def fix_admin_routes():
    path = 'backend/app/api/admin_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix get_dashboard_stats
    content = content.replace(
        'from app.models.knowledge import PlatformAuditLog, TenantRegistry, PlatformAdmin',
        'from app.models.knowledge import PlatformAuditLog, Tenant, User'
    )
    content = content.replace(
        "db.query(TenantRegistry).filter(TenantRegistry.status == 'active').count()",
        "db.query(Tenant).filter(Tenant.status == 'ACTIVE').count()"
    )
    content = content.replace(
        "db.query(PlatformAdmin).count()",
        "db.query(User).count()"
    )

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_admin_routes()
