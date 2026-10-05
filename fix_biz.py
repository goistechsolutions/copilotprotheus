import re

with open('backend/app/models/business_knowledge.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """class BusinessDomainModule(GlobalBase):
    __tablename__ = "business_domain_modules"
    __table_args__ = {"schema": "public", "extend_existing": True}

    domain_code = Column(String(64), ForeignKey("public.business_domains.domain_code", ondelete="CASCADE"), primary_key=True, nullable=False, index=True)
    module_id = Column(Integer, ForeignKey("public.protheus_modules_master.id"), primary_key=True, nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())"""

content = re.sub(r'class BusinessDomainModule\(GlobalBase\):.*?created_at = Column\(TIMESTAMP\(timezone=True\), server_default=func.now\(\)\)', replacement, content, flags=re.DOTALL)

with open('backend/app/models/business_knowledge.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed BusinessDomainModule")
