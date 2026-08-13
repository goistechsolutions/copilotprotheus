import httpx

SQL = '''
DO \$\$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_registry') THEN
        ALTER TABLE public.tenant_registry RENAME TO tenant;
    END IF;
END \$\$;
'''

try:
    r = httpx.post('http://5.161.216.50:8000/api/admin/sql', json={'query': SQL}, headers={'Authorization': 'Bearer '})
    print(r.json())
except Exception as e:
    print(e)
