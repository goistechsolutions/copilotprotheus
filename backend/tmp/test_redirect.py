import requests

r = requests.get("https://copilot.elitecorp.tec.br/", allow_redirects=False)
print("Status:", r.status_code)
print("Headers:")
for k, v in r.headers.items():
    print(f"  {k}: {v}")
