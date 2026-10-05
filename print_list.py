import subprocess

cmd = "git show HEAD~3:backend/app/services/company_module_service.py"
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

lines = result.stdout.split('\n')
printing = False
count = 0
for line in lines:
    if "def list_companies" in line:
        printing = True
    if printing:
        print(line)
        count += 1
        if count > 50:
            break
