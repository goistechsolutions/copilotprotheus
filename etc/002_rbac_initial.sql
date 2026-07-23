BEGIN;

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code VARCHAR(60) NOT NULL UNIQUE,
    role_name VARCHAR(120) NOT NULL,
    scope_level VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(150) NOT NULL,
    module_name VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR(180) NOT NULL UNIQUE,
    full_name VARCHAR(180) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_company_access (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    env_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tenant_id, company_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id, tenant_id, company_id)
);

INSERT INTO roles (role_code, role_name, scope_level)
VALUES
('platform_admin','Administrador da Plataforma','platform'),
('tenant_admin','Administrador do Cliente','tenant'),
('ops_analyst','Analista Operacional','tenant'),
('business_user','Usuário de Negócio','company'),
('auditor','Auditor','tenant')
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO permissions (permission_code, permission_name, module_name)
VALUES
('tenant.manage','Gerenciar tenants','admin'),
('company.manage','Gerenciar empresas','admin'),
('env.manage','Gerenciar ambientes','admin'),
('connector.manage','Gerenciar conectores','integration'),
('kb.manage','Gerenciar base de conhecimento','rag'),
('chat.use','Usar chat','chat'),
('audit.read','Consultar auditoria','audit'),
('infra.read','Consultar infraestrutura','infra')
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
    (r.role_code = 'platform_admin') OR
    (r.role_code = 'tenant_admin' AND p.permission_code IN ('company.manage','env.manage','connector.manage','kb.manage','chat.use','audit.read','infra.read')) OR
    (r.role_code = 'ops_analyst' AND p.permission_code IN ('connector.manage','kb.manage','chat.use','infra.read')) OR
    (r.role_code = 'business_user' AND p.permission_code IN ('chat.use')) OR
    (r.role_code = 'auditor' AND p.permission_code IN ('audit.read','infra.read'))
)
ON CONFLICT DO NOTHING;

COMMIT;
