-- Migration idempotente de ajustes do schema público.
-- Todos os blocos condicionais usam DO $$ ... $$; para execução válida no PostgreSQL.

-- 1. Migrar tenant_registry para tenant somente quando o destino ainda não existir.
DO $$
BEGIN
    IF to_regclass('public.tenant_registry') IS NOT NULL
       AND to_regclass('public.tenant') IS NULL THEN
        ALTER TABLE public.tenant_registry RENAME TO tenant;
    END IF;
END
$$;

-- 2. Renomear constraints legadas, se existirem.
DO $$
BEGIN
    IF to_regclass('public.tenant') IS NOT NULL THEN
        BEGIN
            ALTER TABLE public.tenant
                RENAME CONSTRAINT uq_tenant_registry_tenant_code
                TO uq_tenant_tenant_code;
        EXCEPTION
            WHEN undefined_object THEN NULL;
            WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant
                RENAME CONSTRAINT uq_tenant_registry_schema_name
                TO uq_tenant_schema_name;
        EXCEPTION
            WHEN undefined_object THEN NULL;
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END
$$;

-- 3. Adicionar colunas opcionais ao cadastro público de tenants.
DO $$
BEGIN
    IF to_regclass('public.tenant') IS NOT NULL THEN
        BEGIN
            ALTER TABLE public.tenant ADD COLUMN cnpj varchar(20);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN webapp_url text;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN apirest_url text;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN protheus_user varchar(100);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant
                ADD COLUMN encrypted_protheus_password varchar(255);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant
                ADD COLUMN protheus_ambientes varchar(100)
                DEFAULT ' '::varchar;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN system_prompt text;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant
                ADD COLUMN temperature numeric(3,2) DEFAULT 0.20;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN licenca_uso text;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN contract_info jsonb;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN api_access_info jsonb;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN version varchar(50);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;

        BEGIN
            ALTER TABLE public.tenant ADD COLUMN agent_permissions jsonb;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
    END IF;
END
$$;

-- 4. Criar roles se ainda não existir.
CREATE TABLE IF NOT EXISTS public.roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code   varchar(60) NOT NULL,
    role_name   varchar(120) NOT NULL,
    scope_level varchar(30) NOT NULL,
    created_at  timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_role_code
    ON public.roles (role_code);

-- 5. Adicionar role_id aos usuários sem interromper a migration se já existir.
DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        BEGIN
            ALTER TABLE public.users
                ADD COLUMN role_id uuid REFERENCES public.roles(id);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END;
    END IF;
END
$$;

-- 6. user_roles foi substituída por users.role_id.
DROP TABLE IF EXISTS public.user_roles;

-- 7. Forçar a rechecagem do bootstrap após os ajustes.
DROP TABLE IF EXISTS public.app_bootstrap_flags;
