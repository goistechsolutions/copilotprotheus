"""
backend/app/schemas/company_modules.py

Pydantic V2 — schemas de módulos Protheus por empresa.

Atualização V4:
  CompanyModuleAssignedItem: adicionar company_name e branch_code para
    permitir exibição no frontend sem join extra.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CompanyModuleAvailableItem(BaseModel):
    module_code: str = Field(..., min_length=1, max_length=30)
    module_name: str = Field(..., min_length=1, max_length=120)


class CompanyModuleAssignedItem(BaseModel):
    company_id: int
    tenant_id: str
    company_name: Optional[str] = Field(None, description="Nome da empresa (company_info.company_name)")
    branch_code: Optional[str] = Field(None, max_length=60, description="Filial (company_info.branch_code)")
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
    company_code: Optional[str] = Field(None, description="Código Protheus da empresa")
    branch_code: Optional[str] = Field(None, description="Código Protheus da filial")
    name: Optional[str] = Field(None, description="Alias legado — equivale a company_name")
    company_name: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CompanyListResponse(BaseModel):
    status: str
    items: List[CompanyListItem]
