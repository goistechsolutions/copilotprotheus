-- =============================================================
-- COPILOT PROTHEUS — Migration 001
-- Tabelas espelho das principais entidades do Protheus® no PostgreSQL
-- Baseado em: Tabelas-de-referencia.pdf
--
-- REGRAS DE OURO:
--   1. Nunca faça INSERT/UPDATE/DELETE nestas tabelas diretamente
--      a partir do Protheus — use ADVPL/TLPP (MATA*, FINA*, ExecAuto)
--   2. Sempre filtre D_E_L_E_T_ = ' ' em qualquer SELECT no Protheus
--   3. Filtre xx_FILIAL conforme o modo na SX2 (C=compartilhada, E=exclusiva)
--   4. R_E_C_N_O_ é chave física — não use como chave de negócio
-- =============================================================

-- Habilita extensão para UUIDs (tokens, sessões)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- SCHEMA PRINCIPAL
-- =============================================================
CREATE SCHEMA IF NOT EXISTS protheus;
CREATE SCHEMA IF NOT EXISTS copilot;

-- =============================================================
-- TABELAS DE CADASTRO
-- =============================================================

-- SA1 — Clientes
CREATE TABLE IF NOT EXISTS protheus.sa1_clientes (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- A1_FILIAL
    codigo          VARCHAR(6)    NOT NULL,                -- A1_COD
    loja            CHAR(2)       NOT NULL DEFAULT '01',   -- A1_LOJA
    nome            VARCHAR(40),                           -- A1_NOME
    nome_fantasia   VARCHAR(20),                           -- A1_NREDUZ
    cnpj_cpf        VARCHAR(14),                           -- A1_CGC
    inscr_estadual  VARCHAR(18),                           -- A1_INSCR
    endereco        VARCHAR(40),                           -- A1_END
    bairro          VARCHAR(20),                           -- A1_BAIRRO
    municipio       VARCHAR(20),                           -- A1_MUN
    estado          CHAR(2),                               -- A1_EST
    cep             VARCHAR(8),                            -- A1_CEP
    telefone        VARCHAR(15),                           -- A1_TEL
    email           VARCHAR(100),                          -- A1_EMAIL
    tipo            CHAR(1),                               -- A1_TIPO (F=Física, J=Jurídica)
    ativo           CHAR(1)       DEFAULT '1',
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',   -- flag deleção lógica
    r_e_c_n_o_      BIGINT,                                -- chave física Protheus
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT sa1_uk UNIQUE (filial, codigo, loja)
);

COMMENT ON TABLE protheus.sa1_clientes IS 'Espelho da tabela SA1 do Protheus® — Cadastro de Clientes';
COMMENT ON COLUMN protheus.sa1_clientes.d_e_l_e_t_ IS 'Flag deleção lógica. Sempre filtre WHERE d_e_l_e_t_ = chr(32)';

-- SB1 — Produtos
CREATE TABLE IF NOT EXISTS protheus.sb1_produtos (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- B1_FILIAL
    codigo          VARCHAR(15)   NOT NULL,                -- B1_COD
    descricao       VARCHAR(30),                           -- B1_DESC
    tipo            CHAR(2),                               -- B1_TIPO
    unidade         CHAR(2),                               -- B1_UM
    grupo           VARCHAR(4),                            -- B1_GRUPO
    preco_venda     NUMERIC(14,2),                         -- B1_PRV1
    preco_custo     NUMERIC(14,2),                         -- B1_CUSTD
    ncm             VARCHAR(8),                            -- B1_POSIPI
    peso_bruto      NUMERIC(9,3),                          -- B1_PESO
    ativo           CHAR(1)       DEFAULT '1',
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT sb1_uk UNIQUE (filial, codigo)
);

COMMENT ON TABLE protheus.sb1_produtos IS 'Espelho da tabela SB1 do Protheus® — Cadastro de Produtos';

-- SB2 — Saldos de Estoque
CREATE TABLE IF NOT EXISTS protheus.sb2_saldos (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- B2_FILIAL
    produto         VARCHAR(15)   NOT NULL,                -- B2_COD
    local           VARCHAR(6)    NOT NULL DEFAULT '01',   -- B2_LOCAL
    quantidade      NUMERIC(12,4) DEFAULT 0,               -- B2_QATU
    quantidade_em_pedido NUMERIC(12,4) DEFAULT 0,          -- B2_QPEDVEN
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT sb2_uk UNIQUE (filial, produto, local)
);

COMMENT ON TABLE protheus.sb2_saldos IS 'Espelho da tabela SB2 do Protheus® — Saldos de Estoque';

-- =============================================================
-- TABELAS FINANCEIRAS
-- =============================================================

-- SE1 — Contas a Receber
CREATE TABLE IF NOT EXISTS protheus.se1_contas_receber (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- E1_FILIAL
    prefixo         CHAR(3),                               -- E1_PREFIXO
    numero          VARCHAR(9),                            -- E1_NUM
    parcela         CHAR(2),                               -- E1_PARCELA
    tipo            CHAR(3),                               -- E1_TIPO
    cliente         VARCHAR(6),                            -- E1_CLIENTE
    loja_cliente    CHAR(2),                               -- E1_LOJA
    emissao         DATE,                                  -- E1_EMISSAO
    vencimento      DATE,                                  -- E1_VENCTO
    vencimento_real DATE,                                  -- E1_VENCREA
    valor           NUMERIC(14,2) DEFAULT 0,               -- E1_VALOR
    saldo           NUMERIC(14,2) DEFAULT 0,               -- E1_SALDO
    situacao        CHAR(1),                               -- E1_STATUS (A=Aberto, B=Baixado)
    natureza        VARCHAR(10),                           -- E1_NATUREZ
    historico       VARCHAR(40),                           -- E1_HIST
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT se1_uk UNIQUE (filial, prefixo, numero, parcela, tipo, cliente, loja_cliente)
);

COMMENT ON TABLE protheus.se1_contas_receber IS 'Espelho da tabela SE1 do Protheus® — Contas a Receber';

-- SE2 — Contas a Pagar
CREATE TABLE IF NOT EXISTS protheus.se2_contas_pagar (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- E2_FILIAL
    prefixo         CHAR(3),                               -- E2_PREFIXO
    numero          VARCHAR(9),                            -- E2_NUM
    parcela         CHAR(2),                               -- E2_PARCELA
    tipo            CHAR(3),                               -- E2_TIPO
    fornecedor      VARCHAR(6),                            -- E2_FORNECE
    loja_fornecedor CHAR(2),                               -- E2_LOJA
    emissao         DATE,                                  -- E2_EMISSAO
    vencimento      DATE,                                  -- E2_VENCTO
    vencimento_real DATE,                                  -- E2_VENCREA
    valor           NUMERIC(14,2) DEFAULT 0,               -- E2_VALOR
    saldo           NUMERIC(14,2) DEFAULT 0,               -- E2_SALDO
    situacao        CHAR(1),                               -- E2_STATUS
    natureza        VARCHAR(10),                           -- E2_NATUREZ
    historico       VARCHAR(40),                           -- E2_HIST
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT se2_uk UNIQUE (filial, prefixo, numero, parcela, tipo, fornecedor, loja_fornecedor)
);

COMMENT ON TABLE protheus.se2_contas_pagar IS 'Espelho da tabela SE2 do Protheus® — Contas a Pagar';

-- =============================================================
-- TABELAS COMERCIAIS / VENDAS
-- =============================================================

-- SC5 — Pedidos de Venda (Cabeçalho)
CREATE TABLE IF NOT EXISTS protheus.sc5_pedidos_venda (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- C5_FILIAL
    numero          VARCHAR(6)    NOT NULL,                -- C5_NUM
    tipo            CHAR(1),                               -- C5_TIPO
    cliente         VARCHAR(6),                            -- C5_CLIENTE
    loja_cliente    CHAR(2),                               -- C5_LOJACLI
    emissao         DATE,                                  -- C5_EMISSAO
    entrega         DATE,                                  -- C5_ENTREGA
    valor_total     NUMERIC(14,2) DEFAULT 0,               -- C5_VALBRUT
    situacao        CHAR(2),                               -- C5_LIBEROK
    vendedor        VARCHAR(6),                            -- C5_VEND1
    condicao_pgto   VARCHAR(3),                            -- C5_CONDPAG
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT sc5_uk UNIQUE (filial, numero)
);

COMMENT ON TABLE protheus.sc5_pedidos_venda IS 'Espelho da tabela SC5 do Protheus® — Pedidos de Venda (Cabeçalho)';

-- SC6 — Itens do Pedido de Venda
CREATE TABLE IF NOT EXISTS protheus.sc6_itens_pedido (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- C6_FILIAL
    numero          VARCHAR(6)    NOT NULL,                -- C6_NUM
    item            CHAR(4)       NOT NULL,                -- C6_ITEM
    produto         VARCHAR(15),                           -- C6_PRODUTO
    descricao       VARCHAR(30),                           -- C6_DESCRI
    quantidade      NUMERIC(12,4) DEFAULT 0,               -- C6_QTDVEN
    quantidade_entregue NUMERIC(12,4) DEFAULT 0,           -- C6_QTDENT
    valor_unitario  NUMERIC(12,4) DEFAULT 0,               -- C6_PRCVEN
    valor_total     NUMERIC(14,2) DEFAULT 0,               -- C6_VALOR
    situacao        CHAR(1),                               -- C6_STATUS
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT sc6_uk UNIQUE (filial, numero, item)
);

COMMENT ON TABLE protheus.sc6_itens_pedido IS 'Espelho da tabela SC6 do Protheus® — Itens do Pedido de Venda';

-- =============================================================
-- TABELAS FISCAIS
-- =============================================================

-- SF2 — Notas Fiscais de Saída (Cabeçalho)
CREATE TABLE IF NOT EXISTS protheus.sf2_nf_saida (
    id              BIGSERIAL PRIMARY KEY,
    filial          CHAR(2)       NOT NULL DEFAULT '',     -- F2_FILIAL
    numero          VARCHAR(9)    NOT NULL,                -- F2_DOC
    serie           CHAR(3),                               -- F2_SERIE
    cliente         VARCHAR(6),                            -- F2_CLIENTE
    loja_cliente    CHAR(2),                               -- F2_LOJA
    emissao         DATE,                                  -- F2_EMISSAO
    valor_total     NUMERIC(14,2) DEFAULT 0,               -- F2_VALBRUT
    valor_icms      NUMERIC(14,2) DEFAULT 0,               -- F2_VALIPI
    chave_nfe       VARCHAR(44),                           -- F2_CHVNFE
    situacao        CHAR(1),                               -- F2_STATUS
    d_e_l_e_t_      CHAR(1)       NOT NULL DEFAULT ' ',
    r_e_c_n_o_      BIGINT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT sf2_uk UNIQUE (filial, numero, serie)
);

COMMENT ON TABLE protheus.sf2_nf_saida IS 'Espelho da tabela SF2 do Protheus® — Notas Fiscais de Saída';

-- =============================================================
-- TABELAS DO COPILOT (aplicação própria)
-- =============================================================

-- Sessões de chat do Copilot Protheus
CREATE TABLE IF NOT EXISTS copilot.sessoes (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       VARCHAR(50)   NOT NULL,
    usuario_id      VARCHAR(100)  NOT NULL,
    titulo          VARCHAR(200),
    criado_em       TIMESTAMPTZ   DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ   DEFAULT NOW(),
    ativo           BOOLEAN       DEFAULT TRUE
);

-- Mensagens de cada sessão
CREATE TABLE IF NOT EXISTS copilot.mensagens (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id       UUID          NOT NULL REFERENCES copilot.sessoes(id) ON DELETE CASCADE,
    role            VARCHAR(20)   NOT NULL CHECK (role IN ('user','assistant','system')),
    conteudo        TEXT          NOT NULL,
    tokens_entrada  INTEGER       DEFAULT 0,
    tokens_saida    INTEGER       DEFAULT 0,
    modelo          VARCHAR(50),
    criado_em       TIMESTAMPTZ   DEFAULT NOW()
);

-- Log de sincronizações com o Protheus
CREATE TABLE IF NOT EXISTS copilot.sync_log (
    id              BIGSERIAL     PRIMARY KEY,
    tabela_protheus VARCHAR(10)   NOT NULL,
    registros_sync  INTEGER       DEFAULT 0,
    registros_erro  INTEGER       DEFAULT 0,
    status          VARCHAR(20)   NOT NULL CHECK (status IN ('sucesso','erro','parcial')),
    detalhe         TEXT,
    sincronizado_em TIMESTAMPTZ   DEFAULT NOW()
);

-- =============================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================

-- SA1
CREATE INDEX IF NOT EXISTS idx_sa1_cnpj       ON protheus.sa1_clientes (cnpj_cpf);
CREATE INDEX IF NOT EXISTS idx_sa1_nome       ON protheus.sa1_clientes (nome);
CREATE INDEX IF NOT EXISTS idx_sa1_delete     ON protheus.sa1_clientes (d_e_l_e_t_);

-- SB1
CREATE INDEX IF NOT EXISTS idx_sb1_descricao  ON protheus.sb1_produtos (descricao);
CREATE INDEX IF NOT EXISTS idx_sb1_delete     ON protheus.sb1_produtos (d_e_l_e_t_);

-- SE1
CREATE INDEX IF NOT EXISTS idx_se1_vencimento ON protheus.se1_contas_receber (vencimento);
CREATE INDEX IF NOT EXISTS idx_se1_cliente    ON protheus.se1_contas_receber (cliente);
CREATE INDEX IF NOT EXISTS idx_se1_situacao   ON protheus.se1_contas_receber (situacao);
CREATE INDEX IF NOT EXISTS idx_se1_delete     ON protheus.se1_contas_receber (d_e_l_e_t_);

-- SE2
CREATE INDEX IF NOT EXISTS idx_se2_vencimento ON protheus.se2_contas_pagar (vencimento);
CREATE INDEX IF NOT EXISTS idx_se2_fornecedor ON protheus.se2_contas_pagar (fornecedor);
CREATE INDEX IF NOT EXISTS idx_se2_delete     ON protheus.se2_contas_pagar (d_e_l_e_t_);

-- SC5 / SC6
CREATE INDEX IF NOT EXISTS idx_sc5_cliente    ON protheus.sc5_pedidos_venda (cliente);
CREATE INDEX IF NOT EXISTS idx_sc5_emissao    ON protheus.sc5_pedidos_venda (emissao);
CREATE INDEX IF NOT EXISTS idx_sc6_produto    ON protheus.sc6_itens_pedido (produto);

-- Copilot
CREATE INDEX IF NOT EXISTS idx_msg_sessao     ON copilot.mensagens (sessao_id);
CREATE INDEX IF NOT EXISTS idx_sessao_tenant  ON copilot.sessoes (tenant_id, usuario_id);

-- =============================================================
-- VIEW UTILITÁRIA — Títulos em aberto (SE1 + SE2)
-- =============================================================

CREATE OR REPLACE VIEW protheus.v_titulos_abertos AS
SELECT
    'CR' AS tipo_titulo,
    filial,
    prefixo,
    numero,
    parcela,
    cliente  AS parceiro,
    loja_cliente AS loja_parceiro,
    emissao,
    vencimento,
    valor,
    saldo,
    situacao
FROM protheus.se1_contas_receber
WHERE d_e_l_e_t_ = ' '
  AND situacao = 'A'

UNION ALL

SELECT
    'CP' AS tipo_titulo,
    filial,
    prefixo,
    numero,
    parcela,
    fornecedor AS parceiro,
    loja_fornecedor AS loja_parceiro,
    emissao,
    vencimento,
    valor,
    saldo,
    situacao
FROM protheus.se2_contas_pagar
WHERE d_e_l_e_t_ = ' '
  AND situacao = 'A';

COMMENT ON VIEW protheus.v_titulos_abertos IS 'Títulos abertos consolidados — CR (Contas a Receber) e CP (Contas a Pagar)';
