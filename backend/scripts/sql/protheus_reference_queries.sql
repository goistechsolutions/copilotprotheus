-- =============================================================================
-- CONSULTAS DE REFERENCIA - TABELAS PROTHEUS NO POSTGRESQL
-- Projeto: CopilotProtheus
-- Regra de ouro: SEMPRE filtrar d_e_l_e_t_ = ' ' (espaco simples)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CLIENTES ATIVOS (SA1)
-- ---------------------------------------------------------------------------
SELECT
    a1_cod          AS codigo,
    a1_loja         AS loja,
    a1_nome         AS nome,
    a1_nreduz       AS nome_reduzido,
    a1_cnpj         AS cnpj,
    a1_est          AS estado,
    a1_tipo         AS tipo,
    sincronizado_em
FROM protheus_clientes_sa1
WHERE d_e_l_e_t_ = ' '
  AND a1_msblql <> '1'   -- exclui bloqueados
ORDER BY a1_nome;

-- ---------------------------------------------------------------------------
-- 2. PRODUTOS POR TIPO (SB1)
-- ---------------------------------------------------------------------------
SELECT
    b1_cod     AS codigo,
    b1_desc    AS descricao,
    b1_um      AS unidade,
    b1_tipo    AS tipo,  -- PA=Prod Acabado  MP=Materia Prima  ME=Mercadoria
    b1_grupo   AS grupo,
    b1_rastro  AS rastreavel_lote
FROM protheus_produtos_sb1
WHERE d_e_l_e_t_ = ' '
ORDER BY b1_tipo, b1_cod;

-- ---------------------------------------------------------------------------
-- 3. SALDO DE ESTOQUE (SB2) com produto
-- ---------------------------------------------------------------------------
SELECT
    sb2.b2_cod      AS codigo,
    sb1.b1_desc     AS descricao,
    sb2.b2_local    AS almoxarifado,
    sb2.b2_qatu     AS saldo_atual,
    sb2.b2_qemp     AS qtd_empenhada,
    sb2.b2_qatu - sb2.b2_qemp AS saldo_disponivel,
    sb2.b2_cm       AS custo_medio
FROM protheus_saldos_sb2 sb2
LEFT JOIN protheus_produtos_sb1 sb1
    ON sb1.b1_cod = sb2.b2_cod
    AND sb1.d_e_l_e_t_ = ' '
WHERE sb2.d_e_l_e_t_ = ' '
  AND sb2.b2_qatu > 0
ORDER BY sb2.b2_cod, sb2.b2_local;

-- ---------------------------------------------------------------------------
-- 4. PEDIDOS DE VENDA ABERTOS (SC5 + SC6)
-- ---------------------------------------------------------------------------
SELECT
    sc5.c5_num      AS pedido,
    sc5.c5_emissao  AS emissao,
    sc5.c5_entreg   AS entrega_prevista,
    sa1.a1_nome     AS cliente,
    sc6.c6_produto  AS produto,
    sb1.b1_desc     AS desc_produto,
    sc6.c6_qtdven   AS quantidade,
    sc6.c6_prcven   AS preco_unitario,
    sc6.c6_total    AS total_item
FROM protheus_pedidos_sc5 sc5
INNER JOIN protheus_itenspedido_sc6 sc6
    ON sc6.c6_num = sc5.c5_num
    AND sc6.c6_filial = sc5.c5_filial
    AND sc6.d_e_l_e_t_ = ' '
LEFT JOIN protheus_clientes_sa1 sa1
    ON sa1.a1_cod = sc5.c5_cliente
    AND sa1.d_e_l_e_t_ = ' '
LEFT JOIN protheus_produtos_sb1 sb1
    ON sb1.b1_cod = sc6.c6_produto
    AND sb1.d_e_l_e_t_ = ' '
WHERE sc5.d_e_l_e_t_ = ' '
ORDER BY sc5.c5_emissao DESC, sc5.c5_num;

-- ---------------------------------------------------------------------------
-- 5. CONTAS A RECEBER ABERTAS (SE1)
-- ---------------------------------------------------------------------------
SELECT
    e1_num          AS titulo,
    e1_parcela      AS parcela,
    e1_tipo         AS tipo,
    e1_cliente      AS cliente,
    e1_emissao      AS emissao,
    e1_vencto       AS vencimento,
    e1_valor        AS valor_original,
    e1_saldo        AS saldo_restante,
    CASE
        WHEN e1_vencto < CURRENT_DATE THEN 'VENCIDO'
        WHEN e1_vencto = CURRENT_DATE THEN 'VENCE_HOJE'
        ELSE 'A_VENCER'
    END             AS status_vencimento
FROM protheus_ctareceber_se1
WHERE d_e_l_e_t_ = ' '
  AND e1_situaca = 'A'   -- A=Aberto
ORDER BY e1_vencto;

-- ---------------------------------------------------------------------------
-- 6. CONTAS A PAGAR ABERTAS (SE2)
-- ---------------------------------------------------------------------------
SELECT
    e2_num          AS titulo,
    e2_parcela      AS parcela,
    e2_fornece      AS fornecedor,
    e2_emissao      AS emissao,
    e2_vencto       AS vencimento,
    e2_valor        AS valor_original,
    e2_saldo        AS saldo_restante,
    CASE
        WHEN e2_vencto < CURRENT_DATE THEN 'VENCIDO'
        ELSE 'A_VENCER'
    END             AS status_vencimento
FROM protheus_ctapagar_se2
WHERE d_e_l_e_t_ = ' '
  AND e2_situaca = 'A'
ORDER BY e2_vencto;

-- ---------------------------------------------------------------------------
-- 7. NOTAS FISCAIS DE SAIDA COM CHAVE NFe (SF2)
-- ---------------------------------------------------------------------------
SELECT
    sf2.f2_doc      AS numero_nf,
    sf2.f2_serie    AS serie,
    sf2.f2_emissao  AS emissao,
    sa1.a1_nome     AS cliente,
    sf2.f2_valbrut  AS valor_bruto,
    sf2.f2_chvnfe   AS chave_nfe,
    sf2.f2_status   AS status   -- N=Normal C=Cancelada
FROM protheus_nfsaida_sf2 sf2
LEFT JOIN protheus_clientes_sa1 sa1
    ON sa1.a1_cod = sf2.f2_cliente
    AND sa1.d_e_l_e_t_ = ' '
WHERE sf2.d_e_l_e_t_ = ' '
ORDER BY sf2.f2_emissao DESC;

-- ---------------------------------------------------------------------------
-- 8. RESUMO FINANCEIRO (CxR vs CxP por vencimento)
-- ---------------------------------------------------------------------------
SELECT
    'RECEBER'              AS tipo,
    DATE_TRUNC('month', e1_vencto) AS mes_vencimento,
    SUM(e1_saldo)          AS total
FROM protheus_ctareceber_se1
WHERE d_e_l_e_t_ = ' ' AND e1_situaca = 'A'
GROUP BY 1, 2

UNION ALL

SELECT
    'PAGAR'                AS tipo,
    DATE_TRUNC('month', e2_vencto) AS mes_vencimento,
    SUM(e2_saldo)          AS total
FROM protheus_ctapagar_se2
WHERE d_e_l_e_t_ = ' ' AND e2_situaca = 'A'
GROUP BY 1, 2

ORDER BY mes_vencimento, tipo;

-- ---------------------------------------------------------------------------
-- 9. LOG DE SINCRONIZACOES (status e performance)
-- ---------------------------------------------------------------------------
SELECT
    tabela_protheus,
    tabela_local,
    operacao,
    status,
    registros_lidos,
    registros_inseridos,
    registros_atualizados,
    duracao_segundos,
    iniciado_em,
    finalizado_em
FROM protheus_sync_log
ORDER BY iniciado_em DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- 10. DICIONARIO DE CAMPOS DE UMA TABELA (SX3)
-- ---------------------------------------------------------------------------
-- Substitua 'SB1' pela tabela desejada
SELECT
    x3_campo    AS campo,
    x3_tipo     AS tipo,
    x3_tamanho  AS tamanho,
    x3_decimal  AS decimais,
    x3_titulo   AS label,
    x3_descric  AS descricao,
    x3_usado    AS usado,
    x3_obrigat  AS obrigatorio
FROM protheus_campos_sx3
WHERE x3_arquivo = 'SB1'
ORDER BY x3_campo;
