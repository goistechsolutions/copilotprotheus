-- =============================================================================
-- MIGRATION 001 — CopilotProtheus: Tabelas Core do Protheus no PostgreSQL
-- Referência: Tabelas-de-referencia.pdf
-- Regras:
--   1. Sempre filtrar D_E_L_E_T_ = ' ' (registros logicamente deletados = '*')
--   2. Sempre filtrar xx_FILIAL (modo definido na SX2)
--   3. NUNCA fazer INSERT/UPDATE/DELETE direto — apenas via API ADVPL/ExecAuto
--   4. R_E_C_N_O_ é chave física — nunca usar como chave de negócio
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- busca textual eficiente

-- ---------------------------------------------------------------------------
-- SCHEMA
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS protheus;
CREATE SCHEMA IF NOT EXISTS copilot;

COMMENT ON SCHEMA protheus IS 'Dados replicados do ERP TOTVS Protheus (somente leitura)';
COMMENT ON SCHEMA copilot  IS 'Dados próprios do CopilotProtheus (escrita permitida)';

-- ---------------------------------------------------------------------------
-- TIPO ENUM DE COMPARTILHAMENTO (SX2 X2_MODO)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE protheus.t_modo_compartilhamento AS ENUM ('C', 'E');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- DICIONÁRIO DE DADOS (SX) — tabelas de sistema
-- =============================================================================

-- SX2: Tabelas do sistema
CREATE TABLE IF NOT EXISTS protheus.sx2 (
    x2_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    x2_modulo       BIGINT       NOT NULL,
    x2_chave        VARCHAR(3)   NOT NULL,
    x2_nome         VARCHAR(25)  NOT NULL DEFAULT '',
    x2_nomespa      VARCHAR(25)  NOT NULL DEFAULT '',
    x2_modo         CHAR(1)      NOT NULL DEFAULT 'E', -- C=Compartilhada, E=Exclusiva
    x2_pict         VARCHAR(10)  NOT NULL DEFAULT '',
    x2_unico        VARCHAR(120) NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT pk_sx2 PRIMARY KEY (x2_chave, x2_filial)
);
CREATE INDEX IF NOT EXISTS idx_x2_chave    ON protheus.sx2 (x2_chave);
CREATE INDEX IF NOT EXISTS idx_sx2_modulo  ON protheus.sx2 (x2_modulo);
COMMENT ON TABLE protheus.sx2 IS 'Tabelas do sistema — define modo (Compartilhada/Exclusiva) e path';

-- SX3: Dicionário de Campos
CREATE TABLE IF NOT EXISTS protheus.sx3 (
    x3_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    x3_arquivo      VARCHAR(3)   NOT NULL,
    x3_campo        VARCHAR(10)  NOT NULL,
    x3_tipo         CHAR(1)      NOT NULL DEFAULT 'C', -- C=Char, N=Numeric, D=Date, L=Logical, M=Memo
    x3_tamanho      INTEGER      NOT NULL DEFAULT 0,
    x3_decimal      INTEGER      NOT NULL DEFAULT 0,
    x3_titulo       VARCHAR(30)  NOT NULL DEFAULT '',
    x3_descric      VARCHAR(50)  NOT NULL DEFAULT '',
    x3_picture      VARCHAR(40)  NOT NULL DEFAULT '',
    x3_valid        VARCHAR(200) NOT NULL DEFAULT '',
    x3_usado        CHAR(1)      NOT NULL DEFAULT 'S', -- S=Sim, N=Não
    x3_obrigat      CHAR(1)      NOT NULL DEFAULT 'N',
    x3_browse       CHAR(1)      NOT NULL DEFAULT 'N',
    x3_visual       CHAR(1)      NOT NULL DEFAULT 'A', -- A=Alteravel, V=Visualizar, I=Imutavel
    x3_context      CHAR(1)      NOT NULL DEFAULT 'R', -- R=Real, V=Virtual
    x3_cbox         VARCHAR(200) NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT pk_sx3 PRIMARY KEY (x3_arquivo, x3_campo, x3_filial)
);
CREATE INDEX IF NOT EXISTS idx_sx3_arquivo ON protheus.sx3 (x3_arquivo);
CREATE INDEX IF NOT EXISTS idx_sx3_campo   ON protheus.sx3 (x3_campo);
CREATE INDEX IF NOT EXISTS idx_sx3_delete  ON protheus.sx3 (d_e_l_e_t_);
COMMENT ON TABLE protheus.sx3 IS 'Dicionário de Campos — tipo, tamanho, validações, X3_USADO';

-- =============================================================================
-- CADASTROS PRINCIPAIS
-- =============================================================================

-- SA1: Clientes
CREATE TABLE IF NOT EXISTS protheus.sa1 (
    a1_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    a1_cod          VARCHAR(6)   NOT NULL,
    a1_loja         VARCHAR(2)   NOT NULL DEFAULT '01',
    a1_nome         VARCHAR(40)  NOT NULL DEFAULT '',
    a1_nreduz       VARCHAR(20)  NOT NULL DEFAULT '',
    a1_end          VARCHAR(40)  NOT NULL DEFAULT '',
    a1_est          VARCHAR(2)   NOT NULL DEFAULT '',
    a1_cep          VARCHAR(8)   NOT NULL DEFAULT '',
    a1_tel          VARCHAR(15)  NOT NULL DEFAULT '',
    a1_email        VARCHAR(100) NOT NULL DEFAULT '',
    a1_cgc          VARCHAR(14)  NOT NULL DEFAULT '',
    a1_inscr        VARCHAR(20)  NOT NULL DEFAULT '',
    a1_tipo         CHAR(1)      NOT NULL DEFAULT 'F', -- F=Fisica, J=Juridica
    a1_pessoa       CHAR(1)      NOT NULL DEFAULT 'F',
    a1_msblql       CHAR(1)      NOT NULL DEFAULT '2', -- 1=Bloqueado, 2=Desbloqueado
    a1_ativo        CHAR(1)      NOT NULL DEFAULT 'S',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_sa1 PRIMARY KEY (a1_cod, a1_loja, a1_filial)
);
CREATE INDEX IF NOT EXISTS idx_sa1_nome    ON protheus.sa1 USING gin (a1_nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sa1_cgc     ON protheus.sa1 (a1_cgc);
CREATE INDEX IF NOT EXISTS idx_sa1_delete  ON protheus.sa1 (d_e_l_e_t_);
CREATE INDEX IF NOT EXISTS idx_sa1_filial  ON protheus.sa1 (a1_filial);
COMMENT ON TABLE protheus.sa1 IS 'Cadastro de Clientes';

-- SB1: Produtos
CREATE TABLE IF NOT EXISTS protheus.sb1 (
    b1_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    b1_cod          VARCHAR(15)  NOT NULL,
    b1_desc         VARCHAR(40)  NOT NULL DEFAULT '',
    b1_tipo         VARCHAR(2)   NOT NULL DEFAULT 'PA', -- PA=Produto Acabado, MP=Materia Prima
    b1_um           VARCHAR(2)   NOT NULL DEFAULT 'UN',
    b1_grupo        VARCHAR(4)   NOT NULL DEFAULT '',
    b1_locpad       VARCHAR(6)   NOT NULL DEFAULT '',
    b1_ativo        CHAR(1)      NOT NULL DEFAULT 'S',
    b1_rastro       CHAR(1)      NOT NULL DEFAULT 'N', -- N=Sem Rastro, S=Com Rastro
    b1_lote         CHAR(1)      NOT NULL DEFAULT 'N',
    b1_localiz      CHAR(1)      NOT NULL DEFAULT 'N',
    b1_msblql       CHAR(1)      NOT NULL DEFAULT '2',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_sb1 PRIMARY KEY (b1_cod, b1_filial)
);
CREATE INDEX IF NOT EXISTS idx_sb1_desc    ON protheus.sb1 USING gin (b1_desc gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sb1_tipo    ON protheus.sb1 (b1_tipo);
CREATE INDEX IF NOT EXISTS idx_sb1_delete  ON protheus.sb1 (d_e_l_e_t_);
CREATE INDEX IF NOT EXISTS idx_sb1_filial  ON protheus.sb1 (b1_filial);
COMMENT ON TABLE protheus.sb1 IS 'Cadastro de Produtos';

-- SB2: Saldos de Estoque
CREATE TABLE IF NOT EXISTS protheus.sb2 (
    b2_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    b2_cod          VARCHAR(15)  NOT NULL,
    b2_local        VARCHAR(6)   NOT NULL DEFAULT '',
    b2_qatu         NUMERIC(15,4) NOT NULL DEFAULT 0,
    b2_qtereser     NUMERIC(15,4) NOT NULL DEFAULT 0,
    b2_qpedven      NUMERIC(15,4) NOT NULL DEFAULT 0,
    b2_qaclass      NUMERIC(15,4) NOT NULL DEFAULT 0,
    b2_cm1          NUMERIC(15,6) NOT NULL DEFAULT 0, -- Custo Medio
    b2_cm2          NUMERIC(15,6) NOT NULL DEFAULT 0,
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT        NOT NULL,
    r_e_c_d_e_l_    BIGINT        NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT pk_sb2 PRIMARY KEY (b2_cod, b2_local, b2_filial)
);
CREATE INDEX IF NOT EXISTS idx_sb2_cod     ON protheus.sb2 (b2_cod);
CREATE INDEX IF NOT EXISTS idx_sb2_local   ON protheus.sb2 (b2_local);
CREATE INDEX IF NOT EXISTS idx_sb2_delete  ON protheus.sb2 (d_e_l_e_t_);
COMMENT ON TABLE protheus.sb2 IS 'Saldos de Estoque por Produto/Armazém';

-- =============================================================================
-- FINANCEIRO
-- =============================================================================

-- SE1: Contas a Receber
CREATE TABLE IF NOT EXISTS protheus.se1 (
    e1_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    e1_num          VARCHAR(9)   NOT NULL,
    e1_prefixo      VARCHAR(3)   NOT NULL DEFAULT '',
    e1_parcela      VARCHAR(2)   NOT NULL DEFAULT '',
    e1_tipo         VARCHAR(3)   NOT NULL DEFAULT 'NF',
    e1_cliente      VARCHAR(6)   NOT NULL DEFAULT '',
    e1_loja         VARCHAR(2)   NOT NULL DEFAULT '01',
    e1_nomcli       VARCHAR(40)  NOT NULL DEFAULT '',
    e1_emissao      DATE,
    e1_vencto       DATE,
    e1_vencrea      DATE,
    e1_valor        NUMERIC(15,2) NOT NULL DEFAULT 0,
    e1_saldo        NUMERIC(15,2) NOT NULL DEFAULT 0,
    e1_recpag       CHAR(1)      NOT NULL DEFAULT 'R', -- R=Receber, P=Pagar
    e1_situaca      CHAR(1)      NOT NULL DEFAULT 'A', -- A=Aberto, B=Baixado, C=Cancelado
    e1_moeda        INTEGER      NOT NULL DEFAULT 1,
    e1_naturez      VARCHAR(10)  NOT NULL DEFAULT '',
    e1_portado      VARCHAR(3)   NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_se1 PRIMARY KEY (e1_num, e1_prefixo, e1_parcela, e1_tipo, e1_cliente, e1_loja, e1_filial)
);
CREATE INDEX IF NOT EXISTS idx_se1_cliente  ON protheus.se1 (e1_cliente, e1_loja);
CREATE INDEX IF NOT EXISTS idx_se1_vencto   ON protheus.se1 (e1_vencto);
CREATE INDEX IF NOT EXISTS idx_se1_situacao ON protheus.se1 (e1_situaca);
CREATE INDEX IF NOT EXISTS idx_se1_delete   ON protheus.se1 (d_e_l_e_t_);
CREATE INDEX IF NOT EXISTS idx_se1_filial   ON protheus.se1 (e1_filial);
COMMENT ON TABLE protheus.se1 IS 'Contas a Receber';

-- SE2: Contas a Pagar
CREATE TABLE IF NOT EXISTS protheus.se2 (
    e2_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    e2_num          VARCHAR(9)   NOT NULL,
    e2_prefixo      VARCHAR(3)   NOT NULL DEFAULT '',
    e2_parcela      VARCHAR(2)   NOT NULL DEFAULT '',
    e2_tipo         VARCHAR(3)   NOT NULL DEFAULT 'NF',
    e2_fornece      VARCHAR(6)   NOT NULL DEFAULT '',
    e2_loja         VARCHAR(2)   NOT NULL DEFAULT '01',
    e2_nomfor       VARCHAR(40)  NOT NULL DEFAULT '',
    e2_emissao      DATE,
    e2_vencto       DATE,
    e2_vencrea      DATE,
    e2_valor        NUMERIC(15,2) NOT NULL DEFAULT 0,
    e2_saldo        NUMERIC(15,2) NOT NULL DEFAULT 0,
    e2_situaca      CHAR(1)      NOT NULL DEFAULT 'A',
    e2_moeda        INTEGER      NOT NULL DEFAULT 1,
    e2_naturez      VARCHAR(10)  NOT NULL DEFAULT '',
    e2_portado      VARCHAR(3)   NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_se2 PRIMARY KEY (e2_num, e2_prefixo, e2_parcela, e2_tipo, e2_fornece, e2_loja, e2_filial)
);
CREATE INDEX IF NOT EXISTS idx_se2_fornece  ON protheus.se2 (e2_fornece, e2_loja);
CREATE INDEX IF NOT EXISTS idx_se2_vencto   ON protheus.se2 (e2_vencto);
CREATE INDEX IF NOT EXISTS idx_se2_situacao ON protheus.se2 (e2_situaca);
CREATE INDEX IF NOT EXISTS idx_se2_delete   ON protheus.se2 (d_e_l_e_t_);
COMMENT ON TABLE protheus.se2 IS 'Contas a Pagar';

-- SE5: Movimento Bancário
CREATE TABLE IF NOT EXISTS protheus.se5 (
    e5_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    e5_banco        VARCHAR(3)   NOT NULL DEFAULT '',
    e5_agencia      VARCHAR(5)   NOT NULL DEFAULT '',
    e5_conta        VARCHAR(10)  NOT NULL DEFAULT '',
    e5_prefixo      VARCHAR(3)   NOT NULL DEFAULT '',
    e5_num          VARCHAR(9)   NOT NULL DEFAULT '',
    e5_parcela      VARCHAR(2)   NOT NULL DEFAULT '',
    e5_tipo         VARCHAR(3)   NOT NULL DEFAULT '',
    e5_data         DATE,
    e5_valor        NUMERIC(15,2) NOT NULL DEFAULT 0,
    e5_recpag       CHAR(1)      NOT NULL DEFAULT 'R',
    e5_motbx        VARCHAR(2)   NOT NULL DEFAULT '',
    e5_histor       VARCHAR(60)  NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_se5 PRIMARY KEY (e5_banco, e5_agencia, e5_conta, e5_prefixo, e5_num, e5_parcela, e5_tipo, e5_filial)
);
CREATE INDEX IF NOT EXISTS idx_se5_data    ON protheus.se5 (e5_data);
CREATE INDEX IF NOT EXISTS idx_se5_delete  ON protheus.se5 (d_e_l_e_t_);
COMMENT ON TABLE protheus.se5 IS 'Movimento Bancário';

-- =============================================================================
-- FATURAMENTO / NOTAS FISCAIS
-- =============================================================================

-- SF2: Notas Fiscais de Saída (Cabeçalho)
CREATE TABLE IF NOT EXISTS protheus.sf2 (
    f2_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    f2_doc          VARCHAR(9)   NOT NULL,
    f2_serie        VARCHAR(3)   NOT NULL DEFAULT '',
    f2_cliente      VARCHAR(6)   NOT NULL DEFAULT '',
    f2_loja         VARCHAR(2)   NOT NULL DEFAULT '01',
    f2_emissao      DATE,
    f2_valbrut      NUMERIC(15,2) NOT NULL DEFAULT 0,
    f2_valliq       NUMERIC(15,2) NOT NULL DEFAULT 0,
    f2_valfre       NUMERIC(15,2) NOT NULL DEFAULT 0,
    f2_valicm       NUMERIC(15,2) NOT NULL DEFAULT 0,
    f2_valipi       NUMERIC(15,2) NOT NULL DEFAULT 0,
    f2_chvnfe       VARCHAR(44)  NOT NULL DEFAULT '', -- Chave NF-e
    f2_status       CHAR(1)      NOT NULL DEFAULT 'N', -- N=Normal, C=Cancelada
    f2_tipo         VARCHAR(1)   NOT NULL DEFAULT 'N',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_sf2 PRIMARY KEY (f2_doc, f2_serie, f2_cliente, f2_loja, f2_filial)
);
CREATE INDEX IF NOT EXISTS idx_sf2_emissao  ON protheus.sf2 (f2_emissao);
CREATE INDEX IF NOT EXISTS idx_sf2_cliente  ON protheus.sf2 (f2_cliente);
CREATE INDEX IF NOT EXISTS idx_sf2_chvnfe   ON protheus.sf2 (f2_chvnfe);
CREATE INDEX IF NOT EXISTS idx_sf2_delete   ON protheus.sf2 (d_e_l_e_t_);
COMMENT ON TABLE protheus.sf2 IS 'Notas Fiscais de Saída — Cabeçalho';

-- SD2: Itens de Nota Fiscal de Saída
CREATE TABLE IF NOT EXISTS protheus.sd2 (
    d2_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    d2_doc          VARCHAR(9)   NOT NULL,
    d2_serie        VARCHAR(3)   NOT NULL DEFAULT '',
    d2_item         VARCHAR(2)   NOT NULL DEFAULT '',
    d2_cod          VARCHAR(15)  NOT NULL DEFAULT '',
    d2_descri       VARCHAR(40)  NOT NULL DEFAULT '',
    d2_um           VARCHAR(2)   NOT NULL DEFAULT 'UN',
    d2_quant        NUMERIC(15,4) NOT NULL DEFAULT 0,
    d2_prunit       NUMERIC(15,6) NOT NULL DEFAULT 0,
    d2_total        NUMERIC(15,2) NOT NULL DEFAULT 0,
    d2_cliente      VARCHAR(6)   NOT NULL DEFAULT '',
    d2_loja         VARCHAR(2)   NOT NULL DEFAULT '01',
    d2_cf           VARCHAR(5)   NOT NULL DEFAULT '', -- CFOP
    d2_tes          VARCHAR(3)   NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_sd2 PRIMARY KEY (d2_doc, d2_serie, d2_item, d2_cod, d2_cliente, d2_loja, d2_filial)
);
CREATE INDEX IF NOT EXISTS idx_sd2_cod     ON protheus.sd2 (d2_cod);
CREATE INDEX IF NOT EXISTS idx_sd2_doc     ON protheus.sd2 (d2_doc, d2_serie);
CREATE INDEX IF NOT EXISTS idx_sd2_delete  ON protheus.sd2 (d_e_l_e_t_);
COMMENT ON TABLE protheus.sd2 IS 'Itens de Nota Fiscal de Saída';

-- =============================================================================
-- VENDAS / PEDIDOS
-- =============================================================================

-- SC5: Pedidos de Venda (Cabeçalho)
CREATE TABLE IF NOT EXISTS protheus.sc5 (
    c5_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    c5_num          VARCHAR(6)   NOT NULL,
    c5_cliente      VARCHAR(6)   NOT NULL DEFAULT '',
    c5_lojacli      VARCHAR(2)   NOT NULL DEFAULT '01',
    c5_emissao      DATE,
    c5_entrega      DATE,
    c5_tipo         CHAR(1)      NOT NULL DEFAULT 'N',
    c5_liberok      CHAR(1)      NOT NULL DEFAULT 'N', -- N=Não liberado, S=Liberado
    c5_nota         VARCHAR(9)   NOT NULL DEFAULT '',
    c5_serie        VARCHAR(3)   NOT NULL DEFAULT '',
    c5_valbrut      NUMERIC(15,2) NOT NULL DEFAULT 0,
    c5_frete        NUMERIC(15,2) NOT NULL DEFAULT 0,
    c5_vendedor     VARCHAR(6)   NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_sc5 PRIMARY KEY (c5_num, c5_filial)
);
CREATE INDEX IF NOT EXISTS idx_sc5_cliente  ON protheus.sc5 (c5_cliente);
CREATE INDEX IF NOT EXISTS idx_sc5_emissao  ON protheus.sc5 (c5_emissao);
CREATE INDEX IF NOT EXISTS idx_sc5_delete   ON protheus.sc5 (d_e_l_e_t_);
COMMENT ON TABLE protheus.sc5 IS 'Pedidos de Venda — Cabeçalho';

-- SC6: Itens do Pedido de Venda
CREATE TABLE IF NOT EXISTS protheus.sc6 (
    c6_filial       VARCHAR(8)   NOT NULL DEFAULT '',
    c6_num          VARCHAR(6)   NOT NULL,
    c6_item         VARCHAR(2)   NOT NULL DEFAULT '',
    c6_produto      VARCHAR(15)  NOT NULL DEFAULT '',
    c6_descri       VARCHAR(40)  NOT NULL DEFAULT '',
    c6_qtdven       NUMERIC(15,4) NOT NULL DEFAULT 0,
    c6_qtdent       NUMERIC(15,4) NOT NULL DEFAULT 0,
    c6_prcven       NUMERIC(15,6) NOT NULL DEFAULT 0,
    c6_valor        NUMERIC(15,2) NOT NULL DEFAULT 0,
    c6_entreg       DATE,
    c6_xum          VARCHAR(2)   NOT NULL DEFAULT 'UN',
    c6_tes          VARCHAR(3)   NOT NULL DEFAULT '',
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_sc6 PRIMARY KEY (c6_num, c6_item, c6_produto, c6_filial)
);
CREATE INDEX IF NOT EXISTS idx_sc6_produto  ON protheus.sc6 (c6_produto);
CREATE INDEX IF NOT EXISTS idx_sc6_num      ON protheus.sc6 (c6_num);
CREATE INDEX IF NOT EXISTS idx_sc6_delete   ON protheus.sc6 (d_e_l_e_t_);
COMMENT ON TABLE protheus.sc6 IS 'Itens do Pedido de Venda';

-- =============================================================================
-- CONTABILIDADE
-- =============================================================================

-- CT2: Lançamentos Contábeis
CREATE TABLE IF NOT EXISTS protheus.ct2 (
    ct2_filial      VARCHAR(8)   NOT NULL DEFAULT '',
    ct2_lote        VARCHAR(8)   NOT NULL,
    ct2_seq         VARCHAR(5)   NOT NULL DEFAULT '',
    ct2_data        DATE,
    ct2_dc          CHAR(1)      NOT NULL DEFAULT 'D', -- D=Débito, C=Crédito
    ct2_conta       VARCHAR(20)  NOT NULL DEFAULT '',
    ct2_valor       NUMERIC(17,2) NOT NULL DEFAULT 0,
    ct2_hist        VARCHAR(60)  NOT NULL DEFAULT '',
    ct2_clvl        VARCHAR(9)   NOT NULL DEFAULT '', -- Centro de Custo
    ct2_moeda       INTEGER      NOT NULL DEFAULT 1,
    ct2_vlmoed      NUMERIC(15,2) NOT NULL DEFAULT 0,
    d_e_l_e_t_      CHAR(1)      NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT       NOT NULL,
    r_e_c_d_e_l_    BIGINT       NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT pk_ct2 PRIMARY KEY (ct2_lote, ct2_seq, ct2_filial)
);
CREATE INDEX IF NOT EXISTS idx_ct2_data     ON protheus.ct2 (ct2_data);
CREATE INDEX IF NOT EXISTS idx_ct2_conta    ON protheus.ct2 (ct2_conta);
CREATE INDEX IF NOT EXISTS idx_ct2_clvl     ON protheus.ct2 (ct2_clvl);
CREATE INDEX IF NOT EXISTS idx_ct2_delete   ON protheus.ct2 (d_e_l_e_t_);
COMMENT ON TABLE protheus.ct2 IS 'Lançamentos Contábeis';

-- =============================================================================
-- TABELAS DO COPILOT (schema próprio — escrita permitida)
-- =============================================================================

-- Registro de sincronizações
CREATE TABLE IF NOT EXISTS copilot.sync_log (
    id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    tabela          VARCHAR(10)  NOT NULL,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    registros_lidos INTEGER      NOT NULL DEFAULT 0,
    registros_novos INTEGER      NOT NULL DEFAULT 0,
    registros_atualizados INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pendente',
    erro            TEXT,
    iniciado_em     TIMESTAMPTZ  DEFAULT NOW(),
    concluido_em    TIMESTAMPTZ
);
COMMENT ON TABLE copilot.sync_log IS 'Log de sincronizações entre Protheus e PostgreSQL';

-- Usuários do Copilot
CREATE TABLE IF NOT EXISTS copilot.usuarios (
    id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    email           VARCHAR(100) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    filial_padrao   VARCHAR(8)   NOT NULL DEFAULT '',
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ  DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ  DEFAULT NOW()
);

-- Histórico de conversas do Copilot
CREATE TABLE IF NOT EXISTS copilot.conversas (
    id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id      UUID         NOT NULL REFERENCES copilot.usuarios(id),
    titulo          VARCHAR(200),
    criado_em       TIMESTAMPTZ  DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copilot.mensagens (
    id              UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversa_id     UUID         NOT NULL REFERENCES copilot.conversas(id) ON DELETE CASCADE,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('user','assistant','system')),
    conteudo        TEXT         NOT NULL,
    tokens_prompt   INTEGER      DEFAULT 0,
    tokens_resposta INTEGER      DEFAULT 0,
    modelo          VARCHAR(50)  DEFAULT 'gpt-4o',
    criado_em       TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON copilot.mensagens (conversa_id);

-- =============================================================================
-- VIEWS UTILITÁRIAS (filtros obrigatórios já embutidos)
-- =============================================================================

-- View: clientes ativos
CREATE OR REPLACE VIEW protheus.v_clientes_ativos AS
SELECT
    a1_filial, a1_cod, a1_loja, a1_nome, a1_nreduz,
    a1_cgc, a1_tipo, a1_end, a1_est, a1_cep,
    a1_tel, a1_email, a1_msblql, sincronizado_em
FROM protheus.sa1
WHERE d_e_l_e_t_ = ' '
  AND a1_msblql  = '2';
COMMENT ON VIEW protheus.v_clientes_ativos IS 'Clientes desbloqueados, sem registros deletados';

-- View: saldo de estoque disponível
CREATE OR REPLACE VIEW protheus.v_estoque_disponivel AS
SELECT
    b2.b2_filial, b2.b2_cod, b1.b1_desc, b1.b1_um, b1.b1_tipo,
    b2.b2_local,
    (b2.b2_qatu - b2.b2_qtereser) AS saldo_disponivel,
    b2.b2_qatu,
    b2.b2_qtereser,
    b2.b2_cm1 AS custo_medio,
    b2.sincronizado_em
FROM protheus.sb2 b2
JOIN protheus.sb1 b1 ON b1.b1_cod = b2.b2_cod AND b1.b1_filial = b2.b2_filial
WHERE b2.d_e_l_e_t_ = ' '
  AND b1.d_e_l_e_t_ = ' '
  AND b2.b2_qatu    > 0;
COMMENT ON VIEW protheus.v_estoque_disponivel IS 'Saldo disponível = Quantidade atual - Reservado';

-- View: títulos a receber em aberto
CREATE OR REPLACE VIEW protheus.v_contas_receber_abertas AS
SELECT
    e1_filial, e1_num, e1_prefixo, e1_parcela,
    e1_cliente, e1_nomcli, e1_emissao, e1_vencto,
    e1_vencrea, e1_valor, e1_saldo, e1_moeda,
    CASE WHEN e1_vencrea < CURRENT_DATE THEN TRUE ELSE FALSE END AS vencido,
    (CURRENT_DATE - e1_vencrea) AS dias_atraso,
    sincronizado_em
FROM protheus.se1
WHERE d_e_l_e_t_ = ' '
  AND e1_situaca  = 'A'
  AND e1_saldo    > 0;
COMMENT ON VIEW protheus.v_contas_receber_abertas IS 'Títulos a receber em aberto com flag de vencimento';

-- View: pedidos de venda com itens
CREATE OR REPLACE VIEW protheus.v_pedidos_venda AS
SELECT
    sc5.c5_filial, sc5.c5_num,
    sc5.c5_cliente, sc5.c5_emissao, sc5.c5_entrega,
    sc5.c5_liberok, sc5.c5_valbrut, sc5.c5_vendedor,
    sc6.c6_item, sc6.c6_produto, sc6.c6_descri,
    sc6.c6_qtdven, sc6.c6_qtdent,
    (sc6.c6_qtdven - sc6.c6_qtdent) AS saldo_entregar,
    sc6.c6_prcven, sc6.c6_valor
FROM protheus.sc5
JOIN protheus.sc6 sc6
  ON sc6.c6_num    = sc5.c5_num
 AND sc6.c6_filial = sc5.c5_filial
WHERE sc5.d_e_l_e_t_ = ' '
  AND sc6.d_e_l_e_t_ = ' ';
COMMENT ON VIEW protheus.v_pedidos_venda IS 'Pedidos de venda com itens e saldo a entregar';

-- =============================================================================
-- FUNÇÃO: atualiza coluna updated_at automaticamente
-- =============================================================================
CREATE OR REPLACE FUNCTION copilot.fn_atualiza_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_usuarios_updated
    BEFORE UPDATE ON copilot.usuarios
    FOR EACH ROW EXECUTE FUNCTION copilot.fn_atualiza_timestamp();

CREATE OR REPLACE TRIGGER trg_conversas_updated
    BEFORE UPDATE ON copilot.conversas
    FOR EACH ROW EXECUTE FUNCTION copilot.fn_atualiza_timestamp();

COMMIT;

-- =============================================================================
-- NOTAS DE USO
-- Sempre filtrar: WHERE d_e_l_e_t_ = ' ' AND xx_filial = $filial
-- Nunca escrever nas tabelas do schema protheus diretamente
-- Prefira usar as views v_* que já trazem os filtros obrigatórios
-- =============================================================================
