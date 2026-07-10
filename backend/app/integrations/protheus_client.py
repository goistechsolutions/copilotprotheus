import requests
from app.core.settings import TIMEOUT_SECONDS, AUTH_MODE

class ProtheusClient:
    def __init__(self, rest_url: str, user: str, password: str, auth_mode: str = AUTH_MODE):
        self.base_url = rest_url.rstrip('/') if rest_url else ""
        self.user = user
        self.password = password
        self.auth_mode = auth_mode

    def _auth(self):
        if self.auth_mode.lower() == 'basic' and self.user:
            return (self.user, self.password)
        return None

    def ping(self):
        url = f"{self.base_url}/"
        r = requests.get(url, timeout=TIMEOUT_SECONDS, auth=self._auth(), verify=False)
        return r

    def get(self, path: str):
        url = f"{self.base_url}/{path.lstrip('/')}"
        r = requests.get(url, timeout=TIMEOUT_SECONDS, auth=self._auth(), verify=False)
        return r
