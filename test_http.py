import urllib.request
from urllib.error import HTTPError

req = urllib.request.Request(
    'https://copilot-api.elitecorp.tec.br/api/license/generate',
    method='POST',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)

try:
    urllib.request.urlopen(req)
except HTTPError as e:
    print(f"Status Code: {e.code}")
    print(e.fp.read().decode())
