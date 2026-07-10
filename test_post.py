import urllib.request
import json
from urllib.error import HTTPError

url = 'https://copilot-api.elitecorp.tec.br/api/companies'
data = json.dumps({"cnpj": "123", "razao_social": "Test"}).encode('utf-8')
req = urllib.request.Request(
    url,
    data=data,
    method='POST',
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Content-Type': 'application/json'}
)

try:
    response = urllib.request.urlopen(req)
    print(f"Status Code: {response.status}")
except HTTPError as e:
    print(f"Status Code: {e.code}")
    try:
        print(e.fp.read().decode())
    except:
        pass
