from pydantic import BaseModel
from typing import Optional

class ConnectionTestResponse(BaseModel):
    ok: bool
    tenant: Optional[str] = None
    rest_url: Optional[str] = None
    webapp_url: Optional[str] = None
    vscode_server_url: Optional[str] = None
    status_code: Optional[int] = None
    body_preview: Optional[str] = None
    error: Optional[str] = None
