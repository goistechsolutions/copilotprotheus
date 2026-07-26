from sqlalchemy import Boolean, Column, DateTime, Integer, BigInteger, Text, String, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from app.database import Base

class TenantDictionarySource(Base):
    __tablename__ = "tenant_dictionary_sources"
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=True)
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    source_type = Column(String(20), nullable=False)
    snapshot_code = Column(String(60), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    error_message = Column(Text)

class DictionaryTable(Base):
    __tablename__ = "dictionary_tables"
    __table_args__ = (
        UniqueConstraint("tenant_id","environment_id","snapshot_code","table_name", name="uq_dictionary_tables"),
        Index("idx_dictionary_tables_lookup","tenant_id","environment_id","table_name"),
    )
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True))
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    snapshot_code = Column(String(60), nullable=False)
    table_name = Column(String(30), nullable=False)
    table_alias = Column(String(80))
    module_code = Column(String(10))
    description = Column(Text)
    physical_name = Column(String(80))
    active_flag = Column(Boolean, nullable=False, default=True)
    raw_payload = Column(JSONB)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

class DictionaryField(Base):
    __tablename__ = "dictionary_fields"
    __table_args__ = (
        UniqueConstraint("tenant_id","environment_id","snapshot_code","table_name","field_name", name="uq_dictionary_fields"),
        Index("idx_dictionary_fields_lookup","tenant_id","environment_id","table_name","field_name"),
    )
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True))
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    snapshot_code = Column(String(60), nullable=False)
    table_name = Column(String(30), nullable=False)
    field_name = Column(String(30), nullable=False)
    title = Column(String(120))
    field_type = Column(String(5))
    length_num = Column(Integer)
    decimal_num = Column(Integer)
    required_flag = Column(Boolean, nullable=False, default=False)
    browse_flag = Column(Boolean, nullable=False, default=False)
    virtual_flag = Column(Boolean, nullable=False, default=False)
    validation_rule = Column(Text)
    relation_rule = Column(Text)
    when_rule = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

class DictionaryIndex(Base):
    __tablename__ = "dictionary_indexes"
    __table_args__ = (
        UniqueConstraint("tenant_id","environment_id","snapshot_code","table_name","index_order", name="uq_dictionary_indexes"),
        Index("idx_dictionary_indexes_lookup","tenant_id","environment_id","table_name"),
    )
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True))
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    snapshot_code = Column(String(60), nullable=False)
    table_name = Column(String(30), nullable=False)
    index_order = Column(String(10), nullable=False)
    nickname = Column(String(80))
    expression = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

class DictionaryGroup(Base):
    __tablename__ = "dictionary_groups"
    __table_args__ = (
        UniqueConstraint("tenant_id","environment_id","snapshot_code","group_name", name="uq_dictionary_groups"),
    )
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True))
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    snapshot_code = Column(String(60), nullable=False)
    group_name = Column(String(80), nullable=False)
    description = Column(Text)
    raw_payload = Column(JSONB)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

class TenantTablePermission(Base):
    __tablename__ = "tenant_table_permissions"
    __table_args__ = (
        UniqueConstraint("tenant_id","environment_id","role_id","table_name", name="uq_tenant_table_permissions"),
        Index("idx_perm_table_lookup","tenant_id","environment_id","role_id","table_name"),
    )
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True))
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    role_id = Column(UUID(as_uuid=True), nullable=False)
    table_name = Column(String(30), nullable=False)
    can_list = Column(Boolean, nullable=False, default=False)
    can_describe = Column(Boolean, nullable=False, default=False)
    can_query = Column(Boolean, nullable=False, default=False)
    approved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

class TenantFieldPermission(Base):
    __tablename__ = "tenant_field_permissions"
    __table_args__ = (
        UniqueConstraint("tenant_id","environment_id","role_id","table_name","field_name", name="uq_tenant_field_permissions"),
        Index("idx_perm_field_lookup","tenant_id","environment_id","role_id","table_name","field_name"),
    )
    id = Column(BigInteger, primary_key=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True))
    environment_id = Column(UUID(as_uuid=True), nullable=False)
    role_id = Column(UUID(as_uuid=True), nullable=False)
    table_name = Column(String(30), nullable=False)
    field_name = Column(String(30), nullable=False)
    can_select = Column(Boolean, nullable=False, default=False)
    can_filter = Column(Boolean, nullable=False, default=False)
    masked_flag = Column(Boolean, nullable=False, default=False)
    approved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
