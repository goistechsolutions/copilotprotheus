import requests

try:
    resp = requests.get('http://127.0.0.1:8080/api/companies', headers={"Authorization": "Bearer fake_token_here_if_needed"})
    print(resp.status_code)
    print(resp.text)
except Exception as e:
    print(e)
