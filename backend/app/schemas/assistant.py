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
