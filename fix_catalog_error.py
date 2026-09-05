import re

path = 'backend/app/services/protheus_context_service.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Insert the CatalogValidationError exception
exception_class = '''
class CatalogValidationError(HTTPException):
    def __init__(self, code: str, message: str, internal_details: dict):
        super().__init__(status_code=422, detail=message)
        self.code = code
        self.internal_details = internal_details

'''
content = content.replace('def build_protheus_context', exception_class + 'def build_protheus_context')

# Replace the 403 block with 422 block and collect unknown tables
old_block = '''    for table_name, _alias in table_refs:
        if table_name not in normalized_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Bloqueio de Segurança RBAC: a tabela '{table_name}' não está autorizada no snapshot.",
            )'''

new_block = '''    unknown_tables = set()
    for table_name, _alias in table_refs:
        if table_name not in normalized_allowed:
            unknown_tables.add(table_name)
    
    if unknown_tables:
        raise CatalogValidationError(
            code="SQL_CATALOG_VALIDATION_FAILED",
            message="A solicitação exigiu uma estrutura que não está disponível no dicionário autorizado. Nenhum dado foi carregado ou calculado.",
            internal_details={"unknown_tables": sorted(list(unknown_tables))}
        )'''

content = content.replace(old_block, new_block)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
