from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AskRequest(BaseModel):
    question: str
    tenant_id: Optional[str] = None
    module: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    protheus_token: Optional[str] = None
    session_id: Optional[str] = None
    company: Optional[str] = None
    branch: Optional[str] = None
    environment: Optional[str] = None
    station: Optional[str] = None
    intent: Optional[str] = None
    protheus_data: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = None
    screen_text: Optional[str] = None
    image: Optional[str] = None
    agent_user: Optional[str] = None
    agent_password: Optional[str] = None

class AskResponse(BaseModel):
    answer: str
    intent: Optional[str] = None
    backend: Optional[str] = None
    module: Optional[str] = None
    sql: Optional[str] = None
    warnings: Optional[List[str]] = None
    sources: Optional[List[Dict[str, Any]]] = None
    datasets: Optional[List[Dict[str, Any]]] = None
    labels: Optional[List[str]] = None
    tipo_grafico: Optional[str] = None
    titulo: Optional[str] = None
    insights: Optional[str] = None
    
    # New Layered Response Fields
    executive_summary: Optional[str] = None
    applied_filters: Optional[List[str]] = None
    details: Optional[str] = None
    technical_sql: Optional[str] = None
    kpis: Optional[List[Dict[str, Any]]] = None
    action_buttons: Optional[List[Dict[str, str]]] = None
    
    # Metadados de Auditoria
    audit_trail: Optional[Dict[str, Any]] = None
