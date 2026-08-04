-- ============================================================
-- MIGRATION: V001__estrutura_inicial.sql
-- BANCO    : copilot_protheus
-- DATA     : 2026-08-03
-- AUTOR    : CopilotProtheus / Arquiteto Protheus
-- DESCRICAO: Criação completa da estrutura inicial do banco
--            baseada no dicionário de dados TOTVS Protheus.
--
-- REGRAS PROTHEUS APLICADAS:
--   1. Campo deleted (D_E_L_E_T_): ' '=ativo | '*'=deletado lógico
--   2. Campo filial (xx_FILIAL): primeira coluna, filtro obrigatório
--   3. Campo recno (R_E_C_N_O_): chave física — não usar como FK de negócio
--   4. Compartilhamento: C=compartilhada | E=exclusiva (ver sys_tabelas.modo)
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSÕES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================
-- BLOCO 1: DICIONÁRIO DO SISTEMA (equivalente SX)
-- ============================================================

CREATE TABLE IF NOT EXISTS sys_tabelas (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(10)  NOT NULL UNIQUE,
    descricao   VARCHAR(100) NOT NULL,
    modulo      VARCHAR(20)  NOT NULL,
    modo        CHAR(1)      NOT NULL DEFAULT 'E',   -- C=Compartilhada | E=Exclusiva
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  sys_tabelas         IS 'Equivalente SX2 — catálogo de tabelas Protheus replicadas';
COMMENT ON COLUMN sys_tabelas.modo    IS 'C=Compartilhada entre filiais | E=Exclusiva por filial';

CREATE TABLE IF NOT EXISTS sys_campos (
    id          SERIAL PRIMARY KEY,
    tabela      VARCHAR(10)  NOT NULL,
    campo       VARCHAR(50)  NOT NULL,
    descricao   VARCHAR(100),
    tipo        CHAR(1),                             -- C=Char | N=Numérico | D=Data | L=Lógico
    tamanho     INT,
    decimal     INT          NOT NULL DEFAULT 0,
    obrigatorio BOOLEAN      NOT NULL DEFAULT FALSE,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
    UNIQUE(tabela, campo)
);
COMMENT ON TABLE sys_campos IS 'Equivalente SX3 — dicionário de campos';


-- ============================================================
-- BLOCO 2: CADASTROS BASE
-- ============================================================

-- SA1 — Clientes (SIGAFAT)
CREATE TABLE IF NOT EXISTS sa1_clientes (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',        -- A1_FILIAL
    codigo          VARCHAR(6)   NOT NULL,                   -- A1_COD
    loja            VARCHAR(2)   NOT NULL DEFAULT '01',      -- A1_LOJA
    nome            VARCHAR(40),                             -- A1_NOME
    nome_fantasia   VARCHAR(20),                             -- A1_NREDUZ
    cnpj_cpf        VARCHAR(14),                             -- A1_CGC
    ie              VARCHAR(18),                             -- A1_INSEST
    email           VARCHAR(100),                            -- A1_EMAIL
    telefone        VARCHAR(15),                             -- A1_TEL
    endereco        VARCHAR(40),                             -- A1_END
    cidade          VARCHAR(20),                             -- A1_MUN
    estado          CHAR(2),                                 -- A1_EST
    cep             VARCHAR(8),                              -- A1_CEP
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',        -- D_E_L_E_T_
    recno           BIGSERIAL    UNIQUE,                     -- R_E_C_N_O_
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, codigo, loja)
);
COMMENT ON TABLE  sa1_clientes        IS 'SA1 — Cadastro de Clientes (SIGAFAT)';
COMMENT ON COLUMN sa1_clientes.deleted IS 'D_E_L_E_T_: espaço=ativo | asterisco=deletado lógico';
COMMENT ON COLUMN sa1_clientes.recno   IS 'R_E_C_N_O_: chave física — não usar como FK de negócio';

-- SA2 — Fornecedores (SIGACOM)
CREATE TABLE IF NOT EXISTS sa2_fornecedores (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    codigo          VARCHAR(6)   NOT NULL,                   -- A2_COD
    loja            VARCHAR(2)   NOT NULL DEFAULT '01',
    nome            VARCHAR(40),                             -- A2_NOME
    nome_fantasia   VARCHAR(20),                             -- A2_NREDUZ
    cnpj_cpf        VARCHAR(14),                             -- A2_CGC
    ie              VARCHAR(18),                             -- A2_INSEST
    email           VARCHAR(100),                            -- A2_EMAIL
    telefone        VARCHAR(15),                             -- A2_TEL
    endereco        VARCHAR(40),                             -- A2_END
    cidade          VARCHAR(20),                             -- A2_MUN
    estado          CHAR(2),                                 -- A2_EST
    cep             VARCHAR(8),                              -- A2_CEP
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, codigo, loja)
);
COMMENT ON TABLE sa2_fornecedores IS 'SA2 — Cadastro de Fornecedores (SIGACOM)';

-- SB1 — Produtos (SIGAEST)
CREATE TABLE IF NOT EXISTS sb1_produtos (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    codigo          VARCHAR(15)  NOT NULL,                   -- B1_COD
    descricao       VARCHAR(40),                             -- B1_DESC
    tipo            CHAR(2),                                 -- B1_TIPO: PA|MP|PI|BE|MC
    unidade         VARCHAR(2),                              -- B1_UM
    grupo           VARCHAR(4),                              -- B1_GRUPO
    preco_venda     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- B1_PRV1
    preco_custo     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- B1_CUSTD
    peso_bruto      NUMERIC(12,4) NOT NULL DEFAULT 0,        -- B1_PESO
    peso_liquido    NUMERIC(12,4) NOT NULL DEFAULT 0,        -- B1_PESL
    ncm             VARCHAR(10),                             -- B1_POSIPI
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, codigo)
);
COMMENT ON TABLE  sb1_produtos      IS 'SB1 — Cadastro de Produtos (SIGAEST)';
COMMENT ON COLUMN sb1_produtos.tipo IS 'B1_TIPO: PA=Produto Acabado | MP=Matéria Prima | PI=Produto Intermediário | BE=Beneficiamento | MC=Mercadoria para Comercialização';

-- SB2 — Saldos de Estoque (SIGAEST)
CREATE TABLE IF NOT EXISTS sb2_saldos (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    produto         VARCHAR(15)  NOT NULL,                   -- B2_COD
    local           VARCHAR(6)   NOT NULL DEFAULT '01',      -- B2_LOCAL
    quantidade      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- B2_QATU
    qpedven         NUMERIC(15,4) NOT NULL DEFAULT 0,        -- B2_QPEDVEN
    qpedcom         NUMERIC(15,4) NOT NULL DEFAULT 0,        -- B2_QPEDCOM
    qreserva        NUMERIC(15,4) NOT NULL DEFAULT 0,        -- B2_RESERVA
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, produto, local)
);
COMMENT ON TABLE sb2_saldos IS 'SB2 — Saldos de Estoque por Armazém (SIGAEST)';


-- ============================================================
-- BLOCO 3: COMERCIAL / VENDAS (SIGAFAT)
-- ============================================================

-- SC5 — Cabeçalho Pedido de Venda
CREATE TABLE IF NOT EXISTS sc5_pedidos_venda (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    numero          VARCHAR(6)   NOT NULL,                   -- C5_NUM
    tipo            CHAR(1)      NOT NULL DEFAULT 'N',       -- C5_TIPO
    cliente         VARCHAR(6),                              -- C5_CLIENTE
    loja_cliente    VARCHAR(2)   NOT NULL DEFAULT '01',      -- C5_LOJACLI
    emissao         DATE,                                    -- C5_EMISSAO
    entrega         DATE,                                    -- C5_ENTREGA
    vendedor        VARCHAR(6),                              -- C5_VEND1
    condicao_pgto   VARCHAR(3),                              -- C5_CONDPAG
    tabela_preco    VARCHAR(3),                              -- C5_TABELA
    observacao      TEXT,                                    -- C5_MENNOTA
    valor_total     NUMERIC(15,4) NOT NULL DEFAULT 0,
    status          CHAR(1)      NOT NULL DEFAULT ' ',       -- C5_LIBEROK / C5_BLOQUEI
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, numero)
);
COMMENT ON TABLE sc5_pedidos_venda IS 'SC5 — Cabeçalho de Pedidos de Venda (SIGAFAT)';

-- SC6 — Itens Pedido de Venda
CREATE TABLE IF NOT EXISTS sc6_itens_pedido_venda (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    pedido          VARCHAR(6)   NOT NULL,                   -- C6_NUM
    item            VARCHAR(2)   NOT NULL,                   -- C6_ITEM
    produto         VARCHAR(15),                             -- C6_PRODUTO
    descricao       VARCHAR(40),                             -- C6_DESCRI
    quantidade      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- C6_QTDVEN
    qtd_entregue    NUMERIC(15,4) NOT NULL DEFAULT 0,        -- C6_QTDENT
    preco_unit      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- C6_PRCVEN
    valor_total     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- C6_VALOR
    unidade         VARCHAR(2),                              -- C6_UM
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    UNIQUE(filial, pedido, item)
);
COMMENT ON TABLE sc6_itens_pedido_venda IS 'SC6 — Itens de Pedidos de Venda (SIGAFAT)';


-- ============================================================
-- BLOCO 4: FINANCEIRO (SIGAFIN)
-- ============================================================

-- SE1 — Contas a Receber
CREATE TABLE IF NOT EXISTS se1_contas_receber (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    numero          VARCHAR(9)   NOT NULL,                   -- E1_NUM
    parcela         VARCHAR(2)   NOT NULL DEFAULT '01',      -- E1_PARCELA
    tipo            VARCHAR(3),                              -- E1_TIPO
    cliente         VARCHAR(6),                              -- E1_CLIENTE
    loja            VARCHAR(2)   NOT NULL DEFAULT '01',      -- E1_LOJA
    emissao         DATE,                                    -- E1_EMISSAO
    vencimento      DATE,                                    -- E1_VENCTO
    vencto_real     DATE,                                    -- E1_VENCREA
    valor           NUMERIC(15,4) NOT NULL DEFAULT 0,        -- E1_VALOR
    saldo           NUMERIC(15,4) NOT NULL DEFAULT 0,        -- E1_SALDO
    historico       VARCHAR(40),                             -- E1_HISTOR
    natureza        VARCHAR(10),                             -- E1_NATUREZ
    status_baixa    CHAR(1)      NOT NULL DEFAULT ' ',       -- E1_BAIXA
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, numero, parcela)
);
COMMENT ON TABLE  se1_contas_receber             IS 'SE1 — Contas a Receber (SIGAFIN)';
COMMENT ON COLUMN se1_contas_receber.status_baixa IS 'E1_BAIXA: espaço=aberto | B=baixado';

-- SE2 — Contas a Pagar
CREATE TABLE IF NOT EXISTS se2_contas_pagar (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    numero          VARCHAR(9)   NOT NULL,                   -- E2_NUM
    parcela         VARCHAR(2)   NOT NULL DEFAULT '01',      -- E2_PARCELA
    tipo            VARCHAR(3),                              -- E2_TIPO
    fornecedor      VARCHAR(6),                              -- E2_FORNECE
    loja            VARCHAR(2)   NOT NULL DEFAULT '01',      -- E2_LOJA
    emissao         DATE,                                    -- E2_EMISSAO
    vencimento      DATE,                                    -- E2_VENCTO
    vencto_real     DATE,                                    -- E2_VENCREA
    valor           NUMERIC(15,4) NOT NULL DEFAULT 0,        -- E2_VALOR
    saldo           NUMERIC(15,4) NOT NULL DEFAULT 0,        -- E2_SALDO
    historico       VARCHAR(40),                             -- E2_HISTOR
    natureza        VARCHAR(10),                             -- E2_NATUREZ
    status_baixa    CHAR(1)      NOT NULL DEFAULT ' ',       -- E2_BAIXA
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, numero, parcela)
);
COMMENT ON TABLE se2_contas_pagar IS 'SE2 — Contas a Pagar (SIGAFIN)';

-- SE5 — Movimentação Bancária
CREATE TABLE IF NOT EXISTS se5_movimento_bancario (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    banco           VARCHAR(3),                              -- E5_BANCO
    agencia         VARCHAR(5),                              -- E5_AGENCIA
    conta           VARCHAR(10),                             -- E5_CONTA
    data            DATE,                                    -- E5_DATA
    tipo            CHAR(1),                                 -- E5_TIPODOC
    numero          VARCHAR(9),                              -- E5_NUMBOR
    valor           NUMERIC(15,4) NOT NULL DEFAULT 0,        -- E5_VALOR
    historico       VARCHAR(40),                             -- E5_HISTOR
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE se5_movimento_bancario IS 'SE5 — Movimentação Bancária (SIGAFIN)';


-- ============================================================
-- BLOCO 5: FISCAL / NOTAS FISCAIS (SIGAFIS)
-- ============================================================

-- SF1 — Cabeçalho NF Entrada
CREATE TABLE IF NOT EXISTS sf1_nf_entrada (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    numero          VARCHAR(9)   NOT NULL,                   -- F1_DOC
    serie           VARCHAR(3)   NOT NULL DEFAULT '  ',      -- F1_SERIE
    fornecedor      VARCHAR(6),                              -- F1_FORNECE
    loja            VARCHAR(2)   NOT NULL DEFAULT '01',
    emissao         DATE,                                    -- F1_EMISSAO
    dtdigit         DATE,                                    -- F1_DTDIGIT
    chave_nfe       VARCHAR(44),                             -- F1_CHVNFE
    valor_merc      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- F1_VALMERC
    valor_ipi       NUMERIC(15,4) NOT NULL DEFAULT 0,        -- F1_VALIPI
    valor_total     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- F1_VALBRUT
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, numero, serie, fornecedor, loja)
);
COMMENT ON TABLE sf1_nf_entrada IS 'SF1 — Cabeçalho NF de Entrada (SIGAFIS)';

-- SF2 — Cabeçalho NF Saída
CREATE TABLE IF NOT EXISTS sf2_nf_saida (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    numero          VARCHAR(9)   NOT NULL,                   -- F2_DOC
    serie           VARCHAR(3)   NOT NULL DEFAULT '  ',      -- F2_SERIE
    cliente         VARCHAR(6),                              -- F2_CLIENTE
    loja            VARCHAR(2)   NOT NULL DEFAULT '01',
    emissao         DATE,                                    -- F2_EMISSAO
    chave_nfe       VARCHAR(44),                             -- F2_CHVNFE
    valor_merc      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- F2_VALMERC
    valor_ipi       NUMERIC(15,4) NOT NULL DEFAULT 0,        -- F2_VALIPI
    valor_total     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- F2_VALBRUT
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(filial, numero, serie, cliente, loja)
);
COMMENT ON TABLE sf2_nf_saida IS 'SF2 — Cabeçalho NF de Saída (SIGAFIS)';

-- SD1 — Itens NF Entrada
CREATE TABLE IF NOT EXISTS sd1_itens_nf_entrada (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    documento       VARCHAR(9)   NOT NULL,                   -- D1_DOC
    serie           VARCHAR(3)   NOT NULL DEFAULT '  ',
    item            VARCHAR(2)   NOT NULL,                   -- D1_ITEM
    produto         VARCHAR(15),                             -- D1_COD
    quantidade      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D1_QUANT
    valor_unit      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D1_VUNIT
    valor_total     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D1_TOTAL
    tes             VARCHAR(3),                              -- D1_TES
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    UNIQUE(filial, documento, serie, item)
);
COMMENT ON TABLE sd1_itens_nf_entrada IS 'SD1 — Itens NF de Entrada (SIGACOM/SIGAFIS)';

-- SD2 — Itens NF Saída
CREATE TABLE IF NOT EXISTS sd2_itens_nf_saida (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    documento       VARCHAR(9)   NOT NULL,                   -- D2_DOC
    serie           VARCHAR(3)   NOT NULL DEFAULT '  ',
    item            VARCHAR(2)   NOT NULL,                   -- D2_ITEM
    produto         VARCHAR(15),                             -- D2_COD
    quantidade      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D2_QUANT
    valor_unit      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D2_VUNIT
    valor_total     NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D2_TOTAL
    tes             VARCHAR(3),                              -- D2_TES
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    UNIQUE(filial, documento, serie, item)
);
COMMENT ON TABLE sd2_itens_nf_saida IS 'SD2 — Itens NF de Saída (SIGAFAT/SIGAFIS)';


-- ============================================================
-- BLOCO 6: ESTOQUE — MOVIMENTOS (SIGAEST)
-- ============================================================

CREATE TABLE IF NOT EXISTS sd3_movimentos_estoque (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial          VARCHAR(8)   NOT NULL DEFAULT '',
    produto         VARCHAR(15)  NOT NULL,                   -- D3_COD
    data            DATE,                                    -- D3_DATA
    documento       VARCHAR(9),                              -- D3_DOC
    tipo_mov        VARCHAR(3),                              -- D3_TM
    quantidade      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D3_QUANT
    custo_unit      NUMERIC(15,4) NOT NULL DEFAULT 0,        -- D3_CM1
    local           VARCHAR(6)   NOT NULL DEFAULT '01',      -- D3_LOCAL
    deleted         CHAR(1)      NOT NULL DEFAULT ' ',
    recno           BIGSERIAL    UNIQUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE sd3_movimentos_estoque IS 'SD3 — Movimentos de Estoque (SIGAEST)';


-- ============================================================
-- BLOCO 7: SISTEMA COPILOT
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    senha_hash      VARCHAR(200) NOT NULL,
    nome            VARCHAR(100),
    perfil          VARCHAR(20)  NOT NULL DEFAULT 'usuario',  -- admin | usuario | readonly
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    ultimo_acesso   TIMESTAMP
);
COMMENT ON TABLE  usuarios        IS 'Usuários do CopilotProtheus';
COMMENT ON COLUMN usuarios.perfil IS 'admin=acesso total | usuario=padrão | readonly=somente leitura';

CREATE TABLE IF NOT EXISTS conversas (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id      UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo          VARCHAR(200),
    modulo          VARCHAR(30),                              -- SIGAFAT | SIGAEST | SIGAFIN etc.
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE conversas IS 'Sessões de conversa do Copilot por usuário';

CREATE TABLE IF NOT EXISTS mensagens (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversa_id     UUID         NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
    role            VARCHAR(20)  NOT NULL,                    -- user | assistant | system
    conteudo        TEXT         NOT NULL,
    tokens_entrada  INT          NOT NULL DEFAULT 0,
    tokens_saida    INT          NOT NULL DEFAULT 0,
    modelo          VARCHAR(50),                              -- gpt-4o | gpt-4-turbo etc.
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  mensagens      IS 'Histórico de mensagens por conversa';
COMMENT ON COLUMN mensagens.role IS 'user=pergunta do usuário | assistant=resposta IA | system=instrução de contexto';

CREATE TABLE IF NOT EXISTS contextos_protheus (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversa_id     UUID         REFERENCES conversas(id) ON DELETE SET NULL,
    tabela          VARCHAR(10),                              -- ex: SB1, SA1, SE1
    campo           VARCHAR(50),
    valor           TEXT,
    descricao       VARCHAR(200),
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE contextos_protheus IS 'Contexto de tabelas/campos Protheus vinculados a uma conversa';

CREATE TABLE IF NOT EXISTS logs_auditoria (
    id              UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id      UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
    acao            VARCHAR(50)  NOT NULL,                    -- login | query | export | error
    recurso         VARCHAR(100),
    ip              VARCHAR(45),
    detalhe         JSONB,
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  logs_auditoria      IS 'Auditoria de ações dos usuários no Copilot';
COMMENT ON COLUMN logs_auditoria.acao IS 'login | query | export | error | create | update | delete';


-- ============================================================
-- BLOCO 8: ÍNDICES DE PERFORMANCE
-- Regra: sempre combinar filial + deleted nos índices principais
-- ============================================================

-- SA1 Clientes
CREATE INDEX IF NOT EXISTS idx_sa1_filial_deleted  ON sa1_clientes(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_sa1_codigo          ON sa1_clientes(filial, codigo, loja);
CREATE INDEX IF NOT EXISTS idx_sa1_cnpj            ON sa1_clientes(cnpj_cpf);
CREATE INDEX IF NOT EXISTS idx_sa1_nome_gin        ON sa1_clientes USING gin(nome gin_trgm_ops);

-- SA2 Fornecedores
CREATE INDEX IF NOT EXISTS idx_sa2_filial_deleted  ON sa2_fornecedores(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_sa2_cnpj            ON sa2_fornecedores(cnpj_cpf);

-- SB1 Produtos
CREATE INDEX IF NOT EXISTS idx_sb1_filial_deleted  ON sb1_produtos(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_sb1_tipo            ON sb1_produtos(filial, tipo);
CREATE INDEX IF NOT EXISTS idx_sb1_descricao_gin   ON sb1_produtos USING gin(descricao gin_trgm_ops);

-- SB2 Saldos
CREATE INDEX IF NOT EXISTS idx_sb2_filial_produto  ON sb2_saldos(filial, produto, local);
CREATE INDEX IF NOT EXISTS idx_sb2_deleted         ON sb2_saldos(filial, deleted);

-- SC5 Pedidos Venda
CREATE INDEX IF NOT EXISTS idx_sc5_filial_deleted  ON sc5_pedidos_venda(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_sc5_cliente         ON sc5_pedidos_venda(filial, cliente);
CREATE INDEX IF NOT EXISTS idx_sc5_emissao         ON sc5_pedidos_venda(emissao);
CREATE INDEX IF NOT EXISTS idx_sc5_status          ON sc5_pedidos_venda(status, deleted);

-- SC6 Itens Pedido
CREATE INDEX IF NOT EXISTS idx_sc6_pedido          ON sc6_itens_pedido_venda(filial, pedido);
CREATE INDEX IF NOT EXISTS idx_sc6_produto         ON sc6_itens_pedido_venda(produto);

-- SE1 Contas a Receber
CREATE INDEX IF NOT EXISTS idx_se1_filial_deleted  ON se1_contas_receber(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_se1_cliente         ON se1_contas_receber(filial, cliente);
CREATE INDEX IF NOT EXISTS idx_se1_vencimento      ON se1_contas_receber(vencimento);
CREATE INDEX IF NOT EXISTS idx_se1_status_baixa    ON se1_contas_receber(status_baixa, deleted);

-- SE2 Contas a Pagar
CREATE INDEX IF NOT EXISTS idx_se2_filial_deleted  ON se2_contas_pagar(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_se2_fornecedor      ON se2_contas_pagar(filial, fornecedor);
CREATE INDEX IF NOT EXISTS idx_se2_vencimento      ON se2_contas_pagar(vencimento);
CREATE INDEX IF NOT EXISTS idx_se2_status_baixa    ON se2_contas_pagar(status_baixa, deleted);

-- SE5 Movimento Bancário
CREATE INDEX IF NOT EXISTS idx_se5_filial_data     ON se5_movimento_bancario(filial, data);
CREATE INDEX IF NOT EXISTS idx_se5_banco_conta     ON se5_movimento_bancario(banco, conta);

-- SF1/SF2 Notas Fiscais
CREATE INDEX IF NOT EXISTS idx_sf1_filial_deleted  ON sf1_nf_entrada(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_sf1_emissao         ON sf1_nf_entrada(emissao);
CREATE INDEX IF NOT EXISTS idx_sf2_filial_deleted  ON sf2_nf_saida(filial, deleted);
CREATE INDEX IF NOT EXISTS idx_sf2_emissao         ON sf2_nf_saida(emissao);

-- SD3 Movimentos Estoque
CREATE INDEX IF NOT EXISTS idx_sd3_produto_data    ON sd3_movimentos_estoque(produto, data);
CREATE INDEX IF NOT EXISTS idx_sd3_filial_deleted  ON sd3_movimentos_estoque(filial, deleted);

-- Sistema Copilot
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa  ON mensagens(conversa_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_logs_usuario        ON logs_auditoria(usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_logs_acao           ON logs_auditoria(acao, criado_em);
CREATE INDEX IF NOT EXISTS idx_contextos_conversa  ON contextos_protheus(conversa_id);
CREATE INDEX IF NOT EXISTS idx_contextos_tabela    ON contextos_protheus(tabela);


-- ============================================================
-- BLOCO 9: VIEWS PRONTAS PARA O COPILOT
-- Todas respeitam a regra: WHERE deleted = ' '
-- ============================================================

-- View: Contas a Receber em aberto
CREATE OR REPLACE VIEW vw_cr_aberto AS
SELECT
    filial,
    numero,
    parcela,
    cliente,
    vencimento,
    valor,
    saldo,
    CURRENT_DATE - vencimento       AS dias_atraso,
    CASE
        WHEN CURRENT_DATE > vencimento THEN 'VENCIDO'
        WHEN CURRENT_DATE = vencimento THEN 'VENCE_HOJE'
        ELSE 'A_VENCER'
    END                             AS situacao
FROM se1_contas_receber
WHERE deleted      = ' '
  AND status_baixa = ' '
  AND saldo        > 0;
COMMENT ON VIEW vw_cr_aberto IS 'Títulos a receber em aberto com situação de vencimento';

-- View: Contas a Pagar em aberto
CREATE OR REPLACE VIEW vw_cp_aberto AS
SELECT
    filial,
    numero,
    parcela,
    fornecedor,
    vencimento,
    valor,
    saldo,
    CURRENT_DATE - vencimento       AS dias_atraso,
    CASE
        WHEN CURRENT_DATE > vencimento THEN 'VENCIDO'
        WHEN CURRENT_DATE = vencimento THEN 'VENCE_HOJE'
        ELSE 'A_VENCER'
    END                             AS situacao
FROM se2_contas_pagar
WHERE deleted      = ' '
  AND status_baixa = ' '
  AND saldo        > 0;
COMMENT ON VIEW vw_cp_aberto IS 'Títulos a pagar em aberto com situação de vencimento';

-- View: Saldo de estoque com descrição do produto
CREATE OR REPLACE VIEW vw_estoque_atual AS
SELECT
    s.filial,
    s.produto,
    p.descricao,
    p.unidade,
    p.tipo,
    s.local,
    s.quantidade,
    s.qreserva,
    (s.quantidade - s.qreserva)     AS disponivel,
    s.qpedven,
    s.qpedcom
FROM sb2_saldos s
JOIN sb1_produtos p
  ON p.filial  = s.filial
 AND p.codigo  = s.produto
 AND p.deleted = ' '
WHERE s.deleted    = ' '
  AND s.quantidade > 0;
COMMENT ON VIEW vw_estoque_atual IS 'Saldo de estoque atual com disponível líquido';

-- View: Pedidos de venda com cliente
CREATE OR REPLACE VIEW vw_pedidos_abertos AS
SELECT
    pv.filial,
    pv.numero,
    pv.emissao,
    pv.entrega,
    pv.cliente,
    c.nome                          AS nome_cliente,
    pv.valor_total,
    pv.status,
    pv.vendedor
FROM sc5_pedidos_venda pv
LEFT JOIN sa1_clientes c
       ON c.filial  = pv.filial
      AND c.codigo  = pv.cliente
      AND c.loja    = pv.loja_cliente
      AND c.deleted = ' '
WHERE pv.deleted = ' ';
COMMENT ON VIEW vw_pedidos_abertos IS 'Pedidos de venda com nome do cliente';

-- View: Resumo financeiro por filial
CREATE OR REPLACE VIEW vw_resumo_financeiro AS
SELECT
    filial,
    COUNT(*)            AS qtd_titulos,
    SUM(saldo)          AS total_saldo_receber,
    SUM(CASE WHEN CURRENT_DATE > vencimento THEN saldo ELSE 0 END) AS total_vencido,
    SUM(CASE WHEN CURRENT_DATE <= vencimento THEN saldo ELSE 0 END) AS total_a_vencer
FROM se1_contas_receber
WHERE deleted      = ' '
  AND status_baixa = ' '
  AND saldo        > 0
GROUP BY filial;
COMMENT ON VIEW vw_resumo_financeiro IS 'Resumo de CR por filial: total, vencido e a vencer';


-- ============================================================
-- BLOCO 10: SEED — DADOS INICIAIS
-- ============================================================

INSERT INTO sys_tabelas (codigo, descricao, modulo, modo) VALUES
    ('SA1', 'Clientes',                   'SIGAFAT', 'E'),
    ('SA2', 'Fornecedores',               'SIGACOM', 'E'),
    ('SB1', 'Produtos',                   'SIGAEST', 'C'),
    ('SB2', 'Saldos de Estoque',          'SIGAEST', 'E'),
    ('SC5', 'Pedidos de Venda - Cab.',    'SIGAFAT', 'E'),
    ('SC6', 'Pedidos de Venda - Itens',   'SIGAFAT', 'E'),
    ('SD1', 'Itens NF Entrada',           'SIGACOM', 'E'),
    ('SD2', 'Itens NF Saída',             'SIGAFAT', 'E'),
    ('SD3', 'Movimentos de Estoque',      'SIGAEST', 'E'),
    ('SE1', 'Contas a Receber',           'SIGAFIN', 'E'),
    ('SE2', 'Contas a Pagar',             'SIGAFIN', 'E'),
    ('SE5', 'Movimento Bancário',         'SIGAFIN', 'E'),
    ('SF1', 'NF Entrada - Cabeçalho',     'SIGAFIS', 'E'),
    ('SF2', 'NF Saída - Cabeçalho',       'SIGAFIS', 'E')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- FIM DA MIGRATION V001
-- ============================================================
