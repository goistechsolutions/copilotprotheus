-- =============================================================================
-- MIGRATION 002 — Índices adicionais de performance para consultas frequentes
-- Baseado nas tabelas mais usadas em BI/Power BI (Tabelas-de-referencia.pdf)
-- =============================================================================

BEGIN;

-- SE1: Índice composto para dashboard financeiro
CREATE INDEX IF NOT EXISTS idx_se1_filial_sit_venc
    ON protheus.se1 (e1_filial, e1_situaca, e1_vencrea)
    WHERE d_e_l_e_t_ = ' ';

-- SE2: Índice composto fornecedor + vencimento
CREATE INDEX IF NOT EXISTS idx_se2_filial_sit_venc
    ON protheus.se2 (e2_filial, e2_situaca, e2_vencrea)
    WHERE d_e_l_e_t_ = ' ';

-- SF2: Índice parcial apenas registros não deletados
CREATE INDEX IF NOT EXISTS idx_sf2_filial_emissao_ativo
    ON protheus.sf2 (f2_filial, f2_emissao)
    WHERE d_e_l_e_t_ = ' ' AND f2_status = 'N';

-- SC5: Pedidos em aberto (não faturados)
CREATE INDEX IF NOT EXISTS idx_sc5_aberto
    ON protheus.sc5 (c5_filial, c5_emissao)
    WHERE d_e_l_e_t_ = ' ' AND c5_nota = '';

-- SB2: Produtos com saldo positivo
CREATE INDEX IF NOT EXISTS idx_sb2_saldo_positivo
    ON protheus.sb2 (b2_filial, b2_cod, b2_local)
    WHERE d_e_l_e_t_ = ' ' AND b2_qatu > 0;

-- CT2: Lançamentos por competência
CREATE INDEX IF NOT EXISTS idx_ct2_competencia
    ON protheus.ct2 (ct2_filial, ct2_data, ct2_conta)
    WHERE d_e_l_e_t_ = ' ';

-- Copilot: Mensagens por conversa, ordenadas por data
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_data
    ON copilot.mensagens (conversa_id, criado_em DESC);

COMMIT;
