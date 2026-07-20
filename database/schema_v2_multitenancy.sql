-- Copilot Protheus - Migration v2: Multi-Tenancy Completo
-- Adiciona isolamento por empresa com documentos/memorias compartilhados e exclusivos

-- 1. Adicionar coluna 'visibility' na tabela documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'tenant';
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_visibility ON documents(tenant_id, visibility);

-- 2. Adicionar coluna 'visibility' na tabela memories
ALTER TABLE memories ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'tenant';
CREATE INDEX IF NOT EXISTS idx_memories_visibility ON memories(visibility);
CREATE INDEX IF NOT EXISTS idx_memories_tenant_visibility ON memories(tenant_id, visibility);

-- 3. Adicionar FK tenant_id na tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id);

-- Criar FK (sem constraint NOT NULL para manter compatibilidade com dados existentes)
-- A constraint pode ser ativada depois de popular os dados:
-- ALTER TABLE companies ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_companies_tenant' AND table_name = 'companies'
    ) THEN
        ALTER TABLE companies ADD CONSTRAINT fk_companies_tenant
            FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Migrar dados existentes: marcar documentos existentes como 'shared' (conhecimento global)
UPDATE documents SET visibility = 'shared' WHERE tenant_id = 'default' AND visibility = 'tenant';

-- 5. Migrar protheus_grupo para tenant_id na tabela companies
UPDATE companies SET tenant_id = protheus_grupo WHERE tenant_id IS NULL AND protheus_grupo IS NOT NULL;

-- 6. Indice composto para busca RAG hibrida eficiente
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_id_vector ON document_chunks(document_id) WHERE vector IS NOT NULL;
