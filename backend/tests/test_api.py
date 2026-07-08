import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db

# Override do get_db para evitar conexões físicas durante os testes unitários
mock_session = MagicMock()
app.dependency_overrides[get_db] = lambda: mock_session

client = TestClient(app)

def test_health_check_healthy():
    mock_session.execute.return_value = MagicMock()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "healthy"}

def test_health_check_unhealthy():
    mock_session.execute.side_effect = Exception("Database is offline")
    response = client.get("/health")
    assert response.status_code == 500
    assert response.json()["status"] == "error"
    assert "Database is offline" in response.json()["database"]
    mock_session.execute.side_effect = None

def test_ask_endpoint_unauthorized():
    # Chamadas ao endpoint protegido /api/ask sem token JWT devem falhar com 401
    response = client.post("/api/ask", json={
        "question": "Como consultar o faturamento?",
        "user": "admin",
        "session_id": "123"
    })
    assert response.status_code == 401
