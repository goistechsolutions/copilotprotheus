import httpx
try:
    r = httpx.get('http://5.161.216.50:8000/debug-db')
    print(r.json())
except Exception as e:
    print(e)
