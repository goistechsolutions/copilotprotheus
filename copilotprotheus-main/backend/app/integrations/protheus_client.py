import requests
from app.core.settings import PROTHEUS_REST_URL, PROTHEUS_USER, PROTHEUS_PASSWORD, TIMEOUT_SECONDS, AUTH_MODE

class ProtheusClient:
    def __init__(self):
        self.base_url = PROTHEUS_REST_URL.rstrip('/')

    def _auth(self):
        if AUTH_MODE.lower() == 'basic' and PROTHEUS_USER:
            return (PROTHEUS_USER, PROTHEUS_PASSWORD)
        return None

    def ping(self):
        url = f"{self.base_url}/"
        r = requests.get(url, timeout=TIMEOUT_SECONDS, auth=self._auth(), verify=False)
        return r

    def get(self, path: str):
        url = f"{self.base_url}/{path.lstrip('/')}"
        r = requests.get(url, timeout=TIMEOUT_SECONDS, auth=self._auth(), verify=False)
        return r
