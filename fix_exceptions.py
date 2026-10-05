import re

with open('backend/app/services/company_module_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'raise ValueError(f"Module {sigla} not found")',
    'raise HTTPException(status_code=400, detail={"code": "MODULE_NOT_FOUND", "message": f"Module {sigla} not found"})'
)

# Also fix the exception handler which is catching the HTTPException and re-raising as 500!
replacement = """    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar módulos: {e}")"""

content = re.sub(r'    except Exception as e:\n        db.rollback\(\)\n        raise HTTPException\(status_code=500, detail=f"Erro ao salvar módulos: \{e\}"\)', replacement, content, flags=re.DOTALL)

with open('backend/app/services/company_module_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Fixed exceptions")
