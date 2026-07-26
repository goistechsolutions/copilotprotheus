from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, ConfigDict


class CompanyModuleAvailableItem(BaseModel):
    module_code: str = Field(..., min_length=1, max_length=30)
    module_name: str = Field(..., min_length=1, max_length=120)


class CompanyModuleAssignedItem(BaseModel):
    company_id: int
    tenant_id: str
    module_code: str
    module_name: str
    enabled: bool = True
    created_at: Optional[datetime] = None


class CompanyModuleUpsertItem(BaseModel):
    module_code: str = Field(..., min_length=1, max_length=30)
    enabled: bool = True

    @field_validator("module_code")
    @classmethod
    def normalize_module_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("module_code é obrigatório")
        return value


class CompanyModulesSaveRequest(BaseModel):
    modules: List[CompanyModuleUpsertItem] = Field(default_factory=list)

    @field_validator("modules")
    @classmethod
    def validate_unique_modules(cls, value: List[CompanyModuleUpsertItem]) -> List[CompanyModuleUpsertItem]:
        codes = [item.module_code for item in value]
        if len(codes) != len(set(codes)):
            raise ValueError("A lista contém module_code duplicado")
        return value


class CompanyModulesSyncRequest(BaseModel):
    force_full_reload: bool = False


class CompanyModulesAvailableResponse(BaseModel):
    status: str
    company_id: int
    items: List[CompanyModuleAvailableItem]


class CompanyModulesAssignedResponse(BaseModel):
    status: str
    company_id: int
    items: List[CompanyModuleAssignedItem]


class CompanyModulesSaveResponse(BaseModel):
    status: str
    company_id: int
    modules_saved: int


class CompanyModulesSyncResponse(BaseModel):
    status: str
    company_id: int
    module_filter: List[str]
    snapshot_result: dict


class CompanyListItem(BaseModel):
    id: int
    tenant_id: str
    code: Optional[str] = None
    name: str
    status: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CompanyListResponse(BaseModel):
    status: str
    items: List[CompanyListItem]
