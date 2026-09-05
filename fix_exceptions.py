import re

path = 'backend/app/api/agent_sql_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure CatalogValidationError is imported
if 'CatalogValidationError' not in content:
    content = content.replace('from app.services.protheus_context_service import (\n', 'from app.services.protheus_context_service import (\n    CatalogValidationError,\n')

# Replace the exception block in _agent_worker
old_except = '''                except HTTPException as http_ex:
                    error_info = _normalized_http_exception(
                        http_ex,
                        correlation_id,
                        default_source="protheus_queryrest",
                    )
                    response["status"] = "execution_failed"
                    response["message"] = error_info["message"]
                    response["retryable"] = False
                    response["result"] = None
                    # backward compatibility
                    response["execution_error"] = error_info["message"]
                    response.update(error_info)'''

new_except = '''                except HTTPException as http_ex:
                    error_info = _normalized_http_exception(
                        http_ex,
                        correlation_id,
                        default_source="protheus_queryrest",
                    )
                    
                    if isinstance(http_ex, CatalogValidationError):
                        response["status"] = "validation_failed"
                        response["error_code"] = http_ex.code
                        error_info["error_code"] = http_ex.code
                    elif http_ex.status_code == 403:
                        response["status"] = "forbidden"
                        response["error_code"] = "ENTITLEMENT_DENIED"
                    else:
                        response["status"] = "execution_failed"
                        response["error_code"] = "PROTHEUS_QUERYREST_ERROR"

                    response["message"] = error_info["message"]
                    response["retryable"] = False
                    response["result"] = None
                    # backward compatibility
                    response["execution_error"] = error_info["message"]
                    response.update(error_info)'''

content = content.replace(old_except, new_except)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
