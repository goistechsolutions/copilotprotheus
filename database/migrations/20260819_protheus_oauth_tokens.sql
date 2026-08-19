BEGIN;

CREATE TABLE IF NOT EXISTS public.protheus_rest_connections (
    id BIGSERIAL PRIMARY KEY,
    tenant_code VARCHAR(100) NOT NULL,
    environment_code VARCHAR(100) NOT NULL DEFAULT 'default',
    base_rest_url VARCHAR(500) NOT NULL,
    auth_mode VARCHAR(30) NOT NULL DEFAULT 'oauth2_password',
    protheus_username VARCHAR(255) NOT NULL,
    encrypted_protheus_password TEXT NOT NULL,
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    token_updated_at TIMESTAMPTZ,
    last_auth_error TEXT,
    last_auth_status INTEGER,
    last_success_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_protheus_rest_connections_auth_mode
        CHECK (auth_mode IN ('oauth2_password')),

    CONSTRAINT uq_protheus_rest_connections_tenant_environment UNIQUE (tenant_code, environment_code)
);

CREATE INDEX IF NOT EXISTS ix_protheus_rest_connections_active
    ON public.protheus_rest_connections (tenant_code, environment_code)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS ix_protheus_rest_connections_token_expiry
    ON public.protheus_rest_connections (access_token_expires_at)
    WHERE active = TRUE;

CREATE OR REPLACE FUNCTION public.set_updated_at_protheus_rest_connections()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$ 
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protheus_rest_connections_updated_at
    ON public.protheus_rest_connections;

CREATE TRIGGER trg_protheus_rest_connections_updated_at
BEFORE UPDATE ON public.protheus_rest_connections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_protheus_rest_connections();

COMMENT ON TABLE public.protheus_rest_connections IS
    'Credenciais e tokens OAuth2 do Protheus por tenant e ambiente REST.';

COMMENT ON COLUMN public.protheus_rest_connections.tenant_code IS
    'Tenant proprietário da conexão. Nunca usar em catálogo global de módulos.';

COMMENT ON COLUMN public.protheus_rest_connections.base_rest_url IS
    'URL base REST, sem /QueryRest e sem /api/oauth2/v1/token.';

COMMENT ON COLUMN public.protheus_rest_connections.encrypted_access_token IS
    'Access token cifrado. Nunca armazenar em texto claro.';

COMMENT ON COLUMN public.protheus_rest_connections.encrypted_refresh_token IS
    'Refresh token cifrado. Nunca armazenar em texto claro.';

COMMIT;
