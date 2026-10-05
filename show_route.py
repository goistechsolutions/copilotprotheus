import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'SELECT COUNT(*) FROM public.documents' in line:
        start = max(0, i - 20)
        end = min(len(lines), i + 5)
        for j in range(start, end):
            print(f"{j}: {lines[j]}", end='')
