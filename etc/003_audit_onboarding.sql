BEGIN;

CREATE TABLE IF NOT EXISTS onboarding_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_id UUID REFERENCES companies(id),
    project_code VARCHAR(60) NOT NULL,
    project_name VARCHAR(180) NOT NULL,
    onboarding_status VARCHAR(30) NOT NULL DEFAULT 'planned',
    go_live_target_date DATE,
    owner_name VARCHAR(180),
    owner_email VARCHAR(180),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_code)
);

CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
    task_code VARCHAR(80) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    task_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    assigned_to VARCHAR(180),
    due_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (onboarding_project_id, task_code)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    company_id UUID,
    user_id UUID,
    module_name VARCHAR(80) NOT NULL,
    action_name VARCHAR(120) NOT NULL,
    target_type VARCHAR(80),
    target_id VARCHAR(120),
    request_id VARCHAR(120),
    details_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_project_status ON onboarding_tasks(onboarding_project_id, task_status);

COMMIT;
