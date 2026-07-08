"""
report_routes.py — Rotas FastAPI para geração e download de relatórios Excel e PDF.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import os
import re
from pathlib import Path

from app.services.report_service import ReportService, REPORTS_TMP_DIR
from app.core.auth import get_current_user

router = APIRouter(prefix="/report", tags=["report"])

class GenerateReportRequest(BaseModel):
    report_type: str = Field(..., description="Tipo de relatório (ex: pedidos_abertos, nfs_emitidas, lancamentos)")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Filtros da query REST")
    format: str = Field("xlsx", description="Formato de exportação: 'xlsx' ou 'pdf'")

@router.post("/generate")
async def generate_report(
    payload: GenerateReportRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Garante a filial do contexto se não fornecida
        filters = payload.filters
        if "cFilial" not in filters and "filial" in current_user:
            filters["cFilial"] = current_user["filial"]
            
        file_path_str = await ReportService.generate_report(
            report_type=payload.report_type,
            filters=filters,
            file_format=payload.format,
            tenant_id=current_user.get("tenant_id", "default")
        )
        
        filename = os.path.basename(file_path_str)
        return {
            "success": True,
            "filename": filename,
            "download_url": f"/api/report/download/{filename}"
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar relatório: {str(e)}")

class ExportMarkdownRequest(BaseModel):
    markdown: str = Field(..., description="Conteudo em markdown contendo a tabela")
    format: str = Field("xlsx", description="xlsx ou pdf")
    title: Optional[str] = Field("Exportacao Copilot", description="Titulo do relatorio")

@router.post("/export-markdown")
async def export_markdown_report(
    payload: ExportMarkdownRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        file_path_str = await ReportService.generate_from_markdown(
            markdown_content=payload.markdown,
            file_format=payload.format,
            title=payload.title or "Exportacao Copilot"
        )
        filename = os.path.basename(file_path_str)
        return {
            "success": True,
            "filename": filename,
            "download_url": f"/api/report/download/{filename}"
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao exportar tabela: {str(e)}")

@router.get("/download/{filename}")
def download_report(
    filename: str,
    # Protegido por autenticação para evitar downloads públicos/não-autorizados
    current_user: dict = Depends(get_current_user)
):
    # Proteção de Path Traversal: permite apenas alfanuméricos, pontos, traços e underlines
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", filename):
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")

    file_path = REPORTS_TMP_DIR / filename
    
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=444, detail="Relatório não encontrado ou expirado.")

    # Mapeia Content-Type correto
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if filename.endswith(".pdf"):
        media_type = "application/pdf"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type
    )
