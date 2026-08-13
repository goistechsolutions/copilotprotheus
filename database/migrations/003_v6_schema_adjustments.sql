-- 1. Migração da tabela tenant_registry para tenant
DO  
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_registry') THEN
        ALTER TABLE public.tenant_registry RENAME TO tenant;
    END IF;
END ;

-- Tentar renomear as constraints se existirem, ignorando erro se não existirem
DO  
BEGIN
    BEGIN
        ALTER TABLE public.tenant RENAME CONSTRAINT uq_tenant_registry_tenant_code TO uq_tenant_tenant_code;
    EXCEPTION WHEN OTHERS THEN END;
    BEGIN
        ALTER TABLE public.tenant RENAME CONSTRAINT uq_tenant_registry_schema_name TO uq_tenant_schema_name;
    EXCEPTION WHEN OTHERS THEN END;
END ;

-- 2. Adicionar novas colunas na tabela tenant (caso não existam)
DO  
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant') THEN
        BEGIN ALTER TABLE public.tenant ADD COLUMN cnpj varchar(20); EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN webapp_url text; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN apirest_url text; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN protheus_user varchar(100); EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN encrypted_protheus_password varchar(255); EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN protheus_ambientes varchar(100) default ' '::character varying; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN system_prompt text; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN temperature numeric(3,2) DEFAULT 0.20; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN licenca_uso text; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN contract_info JSONB; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN api_access_info JSONB; EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN version VARCHAR(50); EXCEPTION WHEN duplicate_column THEN END;
        BEGIN ALTER TABLE public.tenant ADD COLUMN agent_permissions JSONB; EXCEPTION WHEN duplicate_column THEN END;
    END IF;
END ;

-- 3. Criar a tabela roles se não existir
CREATE TABLE IF NOT EXISTS public.roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code   VARCHAR(60) NOT NULL,
    role_name   VARCHAR(120) NOT NULL,
    scope_level VARCHAR(30) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_role_code ON public.roles (role_code);

-- 4. Adicionar role_id na tabela users
DO  
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        BEGIN 
            ALTER TABLE public.users ADD COLUMN role_id UUID REFERENCES public.roles(id); 
        EXCEPTION WHEN duplicate_column THEN 
            -- Coluna já existe
        END;
    END IF;
END ;

-- 5. Remover tabela user_roles
DROP TABLE IF EXISTS public.user_roles;

-- 6. Remover tabela app_bootstrap_flags para forçar rechecagem de tabelas
DROP TABLE IF EXISTS public.app_bootstrap_flags;
