import re
path = 'backend/app/api/agent_sql_routes.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

outer_except = '''    except HTTPException as e:
        error_info = _normalized_http_exception(e, correlation_id)
        
        if isinstance(e, CatalogValidationError):
            AGENT_TASKS[task_id] = {
                "status": "validation_failed",
                "error": e.message,
                "error_code": e.code,
                "correlation_id": correlation_id,
            }
        elif e.status_code == 403:
            AGENT_TASKS[task_id] = {
                "status": "forbidden",
                "error": e.detail,
                "error_code": "ENTITLEMENT_DENIED",
                "correlation_id": correlation_id,
            }
        else:
            AGENT_TASKS[task_id] = {
                "status": "error",
                "error": error_info["message"],
                **error_info,
            }
        logger.warning(
            "agent_task_failed task_id=%s status=%s error_source=%s error_code=%s",
            task_id,
            e.status_code,
            error_info["error_source"],
            AGENT_TASKS[task_id].get("error_code") or error_info["error_code"],
        )'''

content = re.sub(
    r'    except HTTPException as e:\n        error_info = _normalized_http_exception\(e, correlation_id\)\n        AGENT_TASKS\[task_id\] = {\n            "status": "error",\n            "error": error_info\["message"\],\n            \*\*error_info,\n        }\n        logger\.warning\(\n            "agent_task_failed task_id=%s status=%s error_source=%s error_code=%s",\n            task_id,\n            e\.status_code,\n            error_info\["error_source"\],\n            error_info\["error_code"\],\n        \)',
    outer_except,
    content
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
