import os
import requests

PROTHEUS_REST_URL = os.getenv('PROTHEUS_REST_URL', 'https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest')

def ping_protheus():
    rest_url = None
    try:
        from app.db.database import SessionLocal
        from app.models.knowledge import Company
        db = SessionLocal()
        comp = db.query(Company).first()
        if comp and comp.protheus_rest_url:
            rest_url = comp.protheus_rest_url
        db.close()
    except Exception:
        pass

    if not rest_url:
        rest_url = os.getenv('PROTHEUS_REST_URL', 'https://rodolltda195384.protheus.cloudtotvs.com.br:10707/rest')

    try:
        r = requests.get(f'{rest_url.rstrip("/")}/health', timeout=5)
        return {'ok': True, 'status_code': r.status_code, 'body': r.text[:200]}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
