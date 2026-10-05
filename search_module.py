with open('backend/app/models/knowledge.py', 'r', encoding='utf-8') as f:
    for line in f:
        if 'module' in line.lower():
            print(line.strip())
