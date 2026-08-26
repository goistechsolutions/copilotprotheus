"""Rotas autenticadas para geração e exportação de relatórios do Copilot."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.services.report_service import REPORTS_TMP_DIR, ReportService

router = APIRouter(prefix="/report", tags=["report"])


class GenerateReportRequest(BaseModel):
    report_type: str = Field(..., description="Tipo de relatório legado compatível")
    tenant_code: str = Field(..., min_length=1, max_length=100)
    environment_code: str = Field(..., min_length=1, max_length=100)
    company_id: Optional[str] = Field(None, max_length=100)
    module_code: Optional[str] = Field(None, max_length=60)
    filters: Dict[str, Any] = Field(default_factory=dict)
    format: Literal["xlsx", "pdf"] = "xlsx"


class ExportStructuredReportRequest(BaseModel):
    tenant_code: str = Field(..., min_length=1, max_length=100)
    environment_code: str = Field(..., min_length=1, max_length=100)
    company_id: Optional[str] = Field(None, max_length=100)
    title: str = Field("Relatório Copilot", min_length=1, max_length=160)
    format: Literal["xlsx", "pdf"] = "xlsx"
    columns: List[str] = Field(default_factory=list, max_length=100)
    rows: List[Dict[str, Any]] = Field(..., max_length=5000)


class ExportMarkdownRequest(BaseModel):
    """Contrato legado; novos consumidores devem usar export-structured."""

    markdown: str = Field(..., min_length=1, max_length=2_000_000)
    format: Literal["xlsx", "pdf"] = "xlsx"
    title: Optional[str] = Field("Exportação Copilot", max_length=160)


def _require_tenant_match(payload_tenant: str, current_user: dict) -> str:
    tenant_code = str(payload_tenant or "").strip().lower()
    token_tenant = str(
        current_user.get("tenant_id")
        or current_user.get("tenantId")
        or ""
    ).strip().lower()
    if not tenant_code or tenant_code in {"default", "none", "null", "public"}:
        raise HTTPException(status_code=400, detail="tenant_code real é obrigatório.")
    if not token_tenant:
        raise HTTPException(status_code=401, detail="JWT sem tenant_id; relatório bloqueado.")
    if token_tenant != "public" and token_tenant != tenant_code:
        raise HTTPException(status_code=403, detail="O tenant do JWT não corresponde ao relatório.")
    return tenant_code


def _require_environment(value: str) -> str:
    environment = str(value or "").strip()
    if not environment or environment.lower() in {"default", "none", "null"}:
        raise HTTPException(status_code=400, detail="environment_code real é obrigatório.")
    return environment


@router.post("/generate")
async def generate_report(
    payload: GenerateReportRequest,
    current_user: dict = Depends(get_current_user),
):
    tenant_code = _require_tenant_match(payload.tenant_code, current_user)
    environment_code = _require_environment(payload.environment_code)
    try:
        filters = dict(payload.filters or {})
        if payload.company_id is not None:
            filters.setdefault("company_id", payload.company_id)
        if payload.module_code is not None:
            filters.setdefault("module_code", payload.module_code)
        if "cFilial" not in filters and current_user.get("filial"):
            filters["cFilial"] = current_user["filial"]

        file_path_str = await ReportService.generate_report(
            report_type=payload.report_type,
            filters=filters,
            file_format=payload.format,
            tenant_id=tenant_code,
            environment_code=environment_code,
        )
        filename = os.path.basename(file_path_str)
        return {
            "success": True,
            "tenant_code": tenant_code,
            "environment_code": environment_code,
            "filename": filename,
            "download_url": f"/api/report/download/{filename}",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Falha no serviço de relatório do Protheus.") from exc


@router.post("/export-structured")
async def export_structured_report(
    payload: ExportStructuredReportRequest,
    current_user: dict = Depends(get_current_user),
):
    tenant_code = _require_tenant_match(payload.tenant_code, current_user)
    environment_code = _require_environment(payload.environment_code)
    try:
        file_path_str = await ReportService.generate_from_result(
            rows=payload.rows,
            file_format=payload.format,
            title=payload.title,
            columns=payload.columns or None,
        )
        filename = os.path.basename(file_path_str)
        return {
            "success": True,
            "tenant_code": tenant_code,
            "environment_code": environment_code,
            "company_id": payload.company_id,
            "records": len(payload.rows),
            "filename": filename,
            "download_url": f"/api/report/download/{filename}",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Falha ao exportar o resultado estruturado.") from exc


@router.post("/export-markdown")
async def export_markdown_report(
    payload: ExportMarkdownRequest,
    current_user: dict = Depends(get_current_user),
):
    # Mantido temporariamente para compatibilidade; não é o caminho principal.
    try:
        file_path_str = await ReportService.generate_from_markdown(
            markdown_content=payload.markdown,
            file_format=payload.format,
            title=payload.title or "Exportação Copilot",
        )
        filename = os.path.basename(file_path_str)
        return {
            "success": True,
            "filename": filename,
            "download_url": f"/api/report/download/{filename}",
            "deprecated": True,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Falha ao exportar tabela legada.") from exc


@router.get("/download/{filename}")
def download_report(
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    if not re.fullmatch(r"[a-zA-Z0-9_\-.]+", filename):
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")

    file_path = REPORTS_TMP_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Relatório não encontrado ou expirado.")

    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if filename.endswith(".pdf"):
        media_type = "application/pdf"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
    )
