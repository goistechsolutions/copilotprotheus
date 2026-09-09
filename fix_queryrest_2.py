import re
path = 'backend/app/services/queryrest_service.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '''        }.get(status_code, "Falha na execu\u00e7\u00e3o do QueryRest do Protheus.")
        raise HTTPException(status_code=status_code, detail=detail)''',
    '''        }.get(status_code, "Falha na execu\u00e7\u00e3o do QueryRest do Protheus.")
        if status_code == 500 and e.response_body:
            detail = f"{detail} Detalhes do banco: {e.response_body[:300]}"
        raise HTTPException(status_code=status_code, detail=detail)'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
