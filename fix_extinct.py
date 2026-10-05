import re

def rewrite_classes():
    # 1. knowledge.py
    path = 'backend/app/models/knowledge.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Delete class Plan and class LicensePlan
    content = re.sub(r'class Plan\(GlobalBase\):.*?active = Column\(Boolean, default=True\)\n\n', '', content, flags=re.DOTALL)
    content = re.sub(r'class LicensePlan\(GlobalBase\):.*?updated_at = Column\(TIMESTAMP\(timezone=True\)\)\n\n', '', content, flags=re.DOTALL)

    new_plan = '''
class Plan(GlobalBase):
    """Corresponde a public.plans"""
    __tablename__ = "plans"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(64), nullable=False, unique=True)
    plan_name = Column(String(160), nullable=False)
    query_limit = Column(Integer)
    concurrent_sessions_limit = Column(Integer)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))
'''
    # Insert new class Plan after TenantContract
    content = re.sub(
        r'(class TenantContract\(GlobalBase\):.*?updated_at = Column\(TIMESTAMP\(timezone=True\)\)\n\n)',
        r'\1' + new_plan.strip() + '\n\n',
        content,
        flags=re.DOTALL
    )

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

    # 2. admin_billing_routes.py
    path = 'backend/app/api/admin_billing_routes.py'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('LicensePlan', 'Plan')
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

    # 3. remove imports
    for p in ['backend/app/api/admin_routes.py', 'backend/app/api/company_routes.py']:
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        c = c.replace('    LicensePlan,\n', '')
        c = c.replace('Company, LicensePlan, AgentQueryAudit,', 'Company, AgentQueryAudit,')
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(c)

rewrite_classes()
