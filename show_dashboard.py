with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(200, min(260, len(lines))):
    print(f"{j}: {lines[j].encode('ascii', 'ignore').decode('ascii')}", end='')
