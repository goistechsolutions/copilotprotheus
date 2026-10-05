import os
import re

directory = "backend/app/"
pattern = re.compile(r'\bpublic\.tenant\b(?!s)')

count = 0
for root, dirs, files in os.walk(directory):
    for filename in files:
        if filename.endswith(".py"):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if pattern.search(content):
                new_content = pattern.sub('public.tenants', content)
                with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(new_content)
                count += 1
                print(f"Fixed {filepath}")

print(f"Total files fixed: {count}")
