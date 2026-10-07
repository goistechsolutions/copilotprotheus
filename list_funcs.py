import re

with open('backend/app/api/company_routes.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "def get_companies" in line or "def create_company" in line or "def update_company" in line:
        print(f"Line {i}: {line.strip()}")
