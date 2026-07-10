import urllib.request
from urllib.error import HTTPError

url = 'https://copilot-api.elitecorp.tec.br/'
req = urllib.request.Request(
    url,
    method='GET',
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    response = urllib.request.urlopen(req)
    print(f"Status Code: {response.status}")
    print(response.read().decode()[:500])
except HTTPError as e:
    print(f"Status Code: {e.code}")
    try:
        print(e.fp.read().decode()[:500])
    except:
        pass
