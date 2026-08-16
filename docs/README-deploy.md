# Deploy Guide
1. Paste backend files: `backend/app/middleware/dynamic_cors.py`, `backend/app/services/tenant_resolver.py`, `backend/app/api/agent/routes.py`, `backend/app/main.py`.
2. Paste middleware files: `middleware/proxy/index.js`, `middleware/package.json`.
3. Paste frontend files: `frontend/src/services/api.js`, `frontend/src/App.jsx`.
4. Apply SQL: `migrations/001_add_tenant_and_company_fields.sql`, `migrations/002_tenant_company_info_example.sql`, `migrations/003_tenant_dictionary_sources.sql`.
5. Set env: `VITE_API_BASE`, `PROTHEUS_BASE_URL`, `PROXY_TIMEOUT_MS`, `INSECURE_TLS`.
6. Rebuild backend/middleware with docker compose.
7. Run tests via `tests/curl_checks.sh`.
