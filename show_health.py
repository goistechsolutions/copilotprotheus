import re

with open('backend/app/api/business_governance_routes.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '@router.get("/health")' in line:
        start = i
        end = min(len(lines), i + 60)
        for j in range(start, end):
            print(f"{j}: {lines[j]}", end='')
