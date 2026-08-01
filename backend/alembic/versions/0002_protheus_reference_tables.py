"""Protheus reference tables - tabelas de referencia do ERP

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-01

Tabelas criadas:
  - protheus_tabelas_sx2  : Dicionario de Tabelas
  - protheus_campos_sx3   : Dicionario de Campos
  - protheus_consultas_sxb: Consultas Padrao (F3)
  - protheus_clientes_sa1 : Clientes (cache/referencia)
  - protheus_produtos_sb1 : Produtos (cache/referencia)
  - protheus_pedidos_sc5  : Cabecalho Pedidos de Venda
  - protheus_itenspedido_sc6 : Itens Pedidos de Venda
  - protheus_ctareceber_se1  : Contas a Receber
  - protheus_ctapagar_se2    : Contas a Pagar
  - protheus_nfsaida_sf2     : Notas Fiscais de Saida
  - protheus_itemnf_sd2      : Itens NF Saida
  - protheus_saldos_sb2      : Saldos de Estoque
  - protheus_movest_sd3      : Movimentos de Estoque
  - protheus_lancctb_ct2     : Lancamentos Contabeis
  - protheus_funcionarios_sra: Funcionarios RH
  - protheus_sync_log        : Log de sincronizacao
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── SX2 ── Dicionario de Tabelas ────────────────────────────────────────
    op.create_table(
        'protheus_tabelas_sx2',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('x2_chave', sa.String(10), nullable=False, comment='Chave da tabela (ex: SB1)'),
        sa.Column('x2_nome', sa.String(80), nullable=True, comment='Nome descritivo da tabela'),
        sa.Column('x2_modo', sa.String(1), nullable=True, comment='C=Compartilhada E=Exclusiva'),
        sa.Column('x2_pict', sa.String(20), nullable=True, comment='Path fisico'),
        sa.Column('x2_unico', sa.String(100), nullable=True, comment='Indice unico'),
        sa.Column('x2_modulo', sa.String(20), nullable=True, comment='Modulo proprietario'),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('x2_chave', name='uq_sx2_chave'),
        comment='Dicionario de Tabelas do Protheus (SX2)'
    )
    op.create_index('ix_protheus_tabelas_sx2_x2_chave', 'protheus_tabelas_sx2', ['x2_chave'])

    # ── SX3 ── Dicionario de Campos ─────────────────────────────────────────
    op.create_table(
        'protheus_campos_sx3',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('x3_arquivo', sa.String(10), nullable=False, comment='Tabela dona do campo (ex: SB1)'),
        sa.Column('x3_campo', sa.String(30), nullable=False, comment='Nome do campo (ex: B1_COD)'),
        sa.Column('x3_tipo', sa.String(1), nullable=True, comment='C=Char N=Num D=Data L=Log M=Memo'),
        sa.Column('x3_tamanho', sa.Integer(), nullable=True),
        sa.Column('x3_decimal', sa.Integer(), nullable=True),
        sa.Column('x3_titulo', sa.String(80), nullable=True, comment='Label do campo'),
        sa.Column('x3_descric', sa.String(200), nullable=True, comment='Descricao longa'),
        sa.Column('x3_usado', sa.String(1), nullable=True, comment='S=Usa N=Nao usa'),
        sa.Column('x3_obrigat', sa.String(1), nullable=True, comment='S=Obrigatorio'),
        sa.Column('x3_browse', sa.String(1), nullable=True, comment='Aparece no browse'),
        sa.Column('x3_valid', sa.Text(), nullable=True, comment='Validacao ADVPL'),
        sa.Column('x3_context', sa.String(1), nullable=True, comment='R=Real V=Virtual'),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('x3_arquivo', 'x3_campo', name='uq_sx3_arquivo_campo'),
        comment='Dicionario de Campos do Protheus (SX3)'
    )
    op.create_index('ix_protheus_campos_sx3_arquivo', 'protheus_campos_sx3', ['x3_arquivo'])
    op.create_index('ix_protheus_campos_sx3_campo', 'protheus_campos_sx3', ['x3_campo'])

    # ── SXB ── Consultas Padrao (F3) ────────────────────────────────────────
    op.create_table(
        'protheus_consultas_sxb',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('xb_alias', sa.String(10), nullable=False, comment='Alias da consulta'),
        sa.Column('xb_tipo', sa.String(1), nullable=True, comment='1=Cabec 2=Ordens 3=Filtro 4=Detalhe 5=Retorno'),
        sa.Column('xb_seq', sa.String(3), nullable=True),
        sa.Column('xb_coluna', sa.String(3), nullable=True),
        sa.Column('xb_descric', sa.String(80), nullable=True),
        sa.Column('xb_conteud', sa.Text(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        comment='Consultas Padrao F3 do Protheus (SXB)'
    )
    op.create_index('ix_protheus_consultas_sxb_alias', 'protheus_consultas_sxb', ['xb_alias'])

    # ── SA1 ── Clientes ─────────────────────────────────────────────────────
    op.create_table(
        'protheus_clientes_sa1',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('a1_filial', sa.String(8), nullable=False, default='', comment='Filial — filtrar conforme SX2'),
        sa.Column('a1_cod', sa.String(6), nullable=False, comment='Codigo do cliente'),
        sa.Column('a1_loja', sa.String(2), nullable=False, default='01', comment='Loja'),
        sa.Column('a1_nome', sa.String(40), nullable=True),
        sa.Column('a1_nreduz', sa.String(20), nullable=True, comment='Nome reduzido'),
        sa.Column('a1_end', sa.String(40), nullable=True),
        sa.Column('a1_est', sa.String(2), nullable=True, comment='Estado'),
        sa.Column('a1_cep', sa.String(8), nullable=True),
        sa.Column('a1_cnpj', sa.String(18), nullable=True),
        sa.Column('a1_tipo', sa.String(1), nullable=True, comment='F=Fisica J=Juridica'),
        sa.Column('a1_msblql', sa.String(1), nullable=True, comment='1=Bloqueado'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' ', comment='Flag delecao logica: *=deletado'),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True, comment='Chave fisica do registro'),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('a1_filial', 'a1_cod', 'a1_loja', name='uq_sa1_filial_cod_loja'),
        comment='Clientes do Protheus (SA1) — apenas registros com D_E_L_E_T_=espaco'
    )
    op.create_index('ix_protheus_clientes_sa1_cod', 'protheus_clientes_sa1', ['a1_cod'])
    op.create_index('ix_protheus_clientes_sa1_cnpj', 'protheus_clientes_sa1', ['a1_cnpj'])
    op.create_index('ix_protheus_clientes_sa1_deletado', 'protheus_clientes_sa1', ['d_e_l_e_t_'])

    # ── SB1 ── Produtos ─────────────────────────────────────────────────────
    op.create_table(
        'protheus_produtos_sb1',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('b1_filial', sa.String(8), nullable=False, default=''),
        sa.Column('b1_cod', sa.String(15), nullable=False, comment='Codigo do produto'),
        sa.Column('b1_desc', sa.String(60), nullable=True, comment='Descricao'),
        sa.Column('b1_um', sa.String(2), nullable=True, comment='Unidade de medida'),
        sa.Column('b1_tipo', sa.String(2), nullable=True, comment='PA=Prod Acabado MP=Materia Prima ME=Merc Revenda'),
        sa.Column('b1_grupo', sa.String(4), nullable=True),
        sa.Column('b1_locpad', sa.String(6), nullable=True, comment='Local padrao'),
        sa.Column('b1_rastro', sa.String(1), nullable=True, comment='S=Rastreavel por lote'),
        sa.Column('b1_msblql', sa.String(1), nullable=True, comment='1=Bloqueado'),
        sa.Column('b1_peso_b', sa.Numeric(12, 3), nullable=True, comment='Peso bruto'),
        sa.Column('b1_peso_l', sa.Numeric(12, 3), nullable=True, comment='Peso liquido'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('b1_filial', 'b1_cod', name='uq_sb1_filial_cod'),
        comment='Produtos do Protheus (SB1)'
    )
    op.create_index('ix_protheus_produtos_sb1_cod', 'protheus_produtos_sb1', ['b1_cod'])
    op.create_index('ix_protheus_produtos_sb1_tipo', 'protheus_produtos_sb1', ['b1_tipo'])

    # ── SB2 ── Saldos de Estoque ────────────────────────────────────────────
    op.create_table(
        'protheus_saldos_sb2',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('b2_filial', sa.String(8), nullable=False, default=''),
        sa.Column('b2_cod', sa.String(15), nullable=False, comment='Codigo do produto'),
        sa.Column('b2_local', sa.String(6), nullable=False, comment='Almoxarifado'),
        sa.Column('b2_qatu', sa.Numeric(15, 4), nullable=True, comment='Saldo atual'),
        sa.Column('b2_qemp', sa.Numeric(15, 4), nullable=True, comment='Qtd empenhada'),
        sa.Column('b2_qpedven', sa.Numeric(15, 4), nullable=True, comment='Qtd pedido venda'),
        sa.Column('b2_cm', sa.Numeric(15, 4), nullable=True, comment='Custo medio'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('b2_filial', 'b2_cod', 'b2_local', name='uq_sb2_filial_cod_local'),
        comment='Saldos de Estoque do Protheus (SB2)'
    )
    op.create_index('ix_protheus_saldos_sb2_cod', 'protheus_saldos_sb2', ['b2_cod'])

    # ── SC5 ── Pedidos de Venda (Cabecalho) ─────────────────────────────────
    op.create_table(
        'protheus_pedidos_sc5',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('c5_filial', sa.String(8), nullable=False, default=''),
        sa.Column('c5_num', sa.String(6), nullable=False, comment='Numero do pedido'),
        sa.Column('c5_cliente', sa.String(6), nullable=True, comment='Codigo do cliente SA1'),
        sa.Column('c5_lojacli', sa.String(2), nullable=True),
        sa.Column('c5_tipo', sa.String(1), nullable=True, comment='N=Normal D=Devolucao'),
        sa.Column('c5_emissao', sa.Date(), nullable=True),
        sa.Column('c5_entreg', sa.Date(), nullable=True, comment='Data entrega prevista'),
        sa.Column('c5_vend1', sa.String(6), nullable=True, comment='Vendedor'),
        sa.Column('c5_condpag', sa.String(3), nullable=True, comment='Condicao de pagamento'),
        sa.Column('c5_tpfrete', sa.String(1), nullable=True, comment='C=CIF F=FOB'),
        sa.Column('c5_xstatus', sa.String(2), nullable=True, comment='Status customizado'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('c5_filial', 'c5_num', name='uq_sc5_filial_num'),
        comment='Pedidos de Venda - Cabecalho (SC5)'
    )
    op.create_index('ix_protheus_pedidos_sc5_num', 'protheus_pedidos_sc5', ['c5_num'])
    op.create_index('ix_protheus_pedidos_sc5_cliente', 'protheus_pedidos_sc5', ['c5_cliente'])
    op.create_index('ix_protheus_pedidos_sc5_emissao', 'protheus_pedidos_sc5', ['c5_emissao'])

    # ── SC6 ── Pedidos de Venda (Itens) ─────────────────────────────────────
    op.create_table(
        'protheus_itenspedido_sc6',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('c6_filial', sa.String(8), nullable=False, default=''),
        sa.Column('c6_num', sa.String(6), nullable=False, comment='Numero do pedido SC5'),
        sa.Column('c6_item', sa.String(4), nullable=False, comment='Item do pedido'),
        sa.Column('c6_produto', sa.String(15), nullable=True, comment='Codigo produto SB1'),
        sa.Column('c6_descri', sa.String(60), nullable=True),
        sa.Column('c6_qtdven', sa.Numeric(15, 4), nullable=True, comment='Qtd vendida'),
        sa.Column('c6_prcven', sa.Numeric(15, 4), nullable=True, comment='Preco venda'),
        sa.Column('c6_total', sa.Numeric(15, 4), nullable=True, comment='Valor total item'),
        sa.Column('c6_entreg', sa.Date(), nullable=True),
        sa.Column('c6_local', sa.String(6), nullable=True, comment='Almoxarifado'),
        sa.Column('c6_bl_est', sa.String(1), nullable=True, comment='Bloqueio de estoque'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('c6_filial', 'c6_num', 'c6_item', name='uq_sc6_filial_num_item'),
        comment='Pedidos de Venda - Itens (SC6)'
    )
    op.create_index('ix_protheus_itenspedido_sc6_num', 'protheus_itenspedido_sc6', ['c6_num'])
    op.create_index('ix_protheus_itenspedido_sc6_produto', 'protheus_itenspedido_sc6', ['c6_produto'])

    # ── SE1 ── Contas a Receber ──────────────────────────────────────────────
    op.create_table(
        'protheus_ctareceber_se1',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('e1_filial', sa.String(8), nullable=False, default=''),
        sa.Column('e1_num', sa.String(9), nullable=False, comment='Numero do titulo'),
        sa.Column('e1_parcela', sa.String(2), nullable=False, comment='Parcela'),
        sa.Column('e1_tipo', sa.String(3), nullable=True, comment='NF=Nota DP=Duplicata'),
        sa.Column('e1_cliente', sa.String(6), nullable=True),
        sa.Column('e1_loja', sa.String(2), nullable=True),
        sa.Column('e1_emissao', sa.Date(), nullable=True),
        sa.Column('e1_vencto', sa.Date(), nullable=True, comment='Vencimento'),
        sa.Column('e1_valor', sa.Numeric(15, 4), nullable=True),
        sa.Column('e1_saldo', sa.Numeric(15, 4), nullable=True, comment='Saldo a receber'),
        sa.Column('e1_situaca', sa.String(1), nullable=True, comment='A=Aberto B=Baixado'),
        sa.Column('e1_naturez', sa.String(10), nullable=True, comment='Natureza financeira'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('e1_filial', 'e1_num', 'e1_parcela', 'e1_tipo', name='uq_se1_titulo'),
        comment='Contas a Receber do Protheus (SE1)'
    )
    op.create_index('ix_protheus_ctareceber_se1_cliente', 'protheus_ctareceber_se1', ['e1_cliente'])
    op.create_index('ix_protheus_ctareceber_se1_vencto', 'protheus_ctareceber_se1', ['e1_vencto'])
    op.create_index('ix_protheus_ctareceber_se1_situaca', 'protheus_ctareceber_se1', ['e1_situaca'])

    # ── SE2 ── Contas a Pagar ────────────────────────────────────────────────
    op.create_table(
        'protheus_ctapagar_se2',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('e2_filial', sa.String(8), nullable=False, default=''),
        sa.Column('e2_num', sa.String(9), nullable=False),
        sa.Column('e2_parcela', sa.String(2), nullable=False),
        sa.Column('e2_tipo', sa.String(3), nullable=True),
        sa.Column('e2_fornece', sa.String(6), nullable=True, comment='Codigo fornecedor SA2'),
        sa.Column('e2_loja', sa.String(2), nullable=True),
        sa.Column('e2_emissao', sa.Date(), nullable=True),
        sa.Column('e2_vencto', sa.Date(), nullable=True),
        sa.Column('e2_valor', sa.Numeric(15, 4), nullable=True),
        sa.Column('e2_saldo', sa.Numeric(15, 4), nullable=True),
        sa.Column('e2_situaca', sa.String(1), nullable=True, comment='A=Aberto B=Baixado'),
        sa.Column('e2_naturez', sa.String(10), nullable=True),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('e2_filial', 'e2_num', 'e2_parcela', 'e2_tipo', name='uq_se2_titulo'),
        comment='Contas a Pagar do Protheus (SE2)'
    )
    op.create_index('ix_protheus_ctapagar_se2_fornece', 'protheus_ctapagar_se2', ['e2_fornece'])
    op.create_index('ix_protheus_ctapagar_se2_vencto', 'protheus_ctapagar_se2', ['e2_vencto'])
    op.create_index('ix_protheus_ctapagar_se2_situaca', 'protheus_ctapagar_se2', ['e2_situaca'])

    # ── SF2 ── Notas Fiscais de Saida ────────────────────────────────────────
    op.create_table(
        'protheus_nfsaida_sf2',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('f2_filial', sa.String(8), nullable=False, default=''),
        sa.Column('f2_doc', sa.String(9), nullable=False, comment='Numero da NF'),
        sa.Column('f2_serie', sa.String(3), nullable=False),
        sa.Column('f2_cliente', sa.String(6), nullable=True),
        sa.Column('f2_loja', sa.String(2), nullable=True),
        sa.Column('f2_emissao', sa.Date(), nullable=True),
        sa.Column('f2_valbrut', sa.Numeric(15, 4), nullable=True, comment='Valor bruto da NF'),
        sa.Column('f2_valfat', sa.Numeric(15, 4), nullable=True, comment='Valor faturado'),
        sa.Column('f2_chvnfe', sa.String(44), nullable=True, comment='Chave de acesso NFe'),
        sa.Column('f2_status', sa.String(1), nullable=True, comment='N=Normal C=Cancelada'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('f2_filial', 'f2_doc', 'f2_serie', name='uq_sf2_nota'),
        comment='Notas Fiscais de Saida do Protheus (SF2)'
    )
    op.create_index('ix_protheus_nfsaida_sf2_doc', 'protheus_nfsaida_sf2', ['f2_doc'])
    op.create_index('ix_protheus_nfsaida_sf2_emissao', 'protheus_nfsaida_sf2', ['f2_emissao'])
    op.create_index('ix_protheus_nfsaida_sf2_chvnfe', 'protheus_nfsaida_sf2', ['f2_chvnfe'])

    # ── SD2 ── Itens NF Saida ────────────────────────────────────────────────
    op.create_table(
        'protheus_itemnf_sd2',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('d2_filial', sa.String(8), nullable=False, default=''),
        sa.Column('d2_doc', sa.String(9), nullable=False),
        sa.Column('d2_serie', sa.String(3), nullable=False),
        sa.Column('d2_item', sa.String(4), nullable=False),
        sa.Column('d2_cod', sa.String(15), nullable=True, comment='Codigo produto SB1'),
        sa.Column('d2_quant', sa.Numeric(15, 4), nullable=True),
        sa.Column('d2_prcven', sa.Numeric(15, 4), nullable=True),
        sa.Column('d2_total', sa.Numeric(15, 4), nullable=True),
        sa.Column('d2_cf', sa.String(5), nullable=True, comment='CFOP'),
        sa.Column('d2_tes', sa.String(3), nullable=True, comment='Tipo de Entrada/Saida SF4'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('d2_filial', 'd2_doc', 'd2_serie', 'd2_item', name='uq_sd2_item'),
        comment='Itens de NF de Saida do Protheus (SD2)'
    )
    op.create_index('ix_protheus_itemnf_sd2_doc', 'protheus_itemnf_sd2', ['d2_doc'])
    op.create_index('ix_protheus_itemnf_sd2_cod', 'protheus_itemnf_sd2', ['d2_cod'])

    # ── SD3 ── Movimentos de Estoque ────────────────────────────────────────
    op.create_table(
        'protheus_movest_sd3',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('d3_filial', sa.String(8), nullable=False, default=''),
        sa.Column('d3_cod', sa.String(15), nullable=False, comment='Produto'),
        sa.Column('d3_data', sa.Date(), nullable=True),
        sa.Column('d3_doc', sa.String(9), nullable=True, comment='Documento origem'),
        sa.Column('d3_tm', sa.String(3), nullable=True, comment='Tipo de Movimento'),
        sa.Column('d3_quant', sa.Numeric(15, 4), nullable=True),
        sa.Column('d3_prcven', sa.Numeric(15, 4), nullable=True),
        sa.Column('d3_total', sa.Numeric(15, 4), nullable=True),
        sa.Column('d3_local', sa.String(6), nullable=True),
        sa.Column('d3_estorno', sa.String(1), nullable=True, comment='E=Estorno'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        comment='Movimentos de Estoque do Protheus (SD3)'
    )
    op.create_index('ix_protheus_movest_sd3_cod', 'protheus_movest_sd3', ['d3_cod'])
    op.create_index('ix_protheus_movest_sd3_data', 'protheus_movest_sd3', ['d3_data'])
    op.create_index('ix_protheus_movest_sd3_tm', 'protheus_movest_sd3', ['d3_tm'])

    # ── CT2 ── Lancamentos Contabeis ────────────────────────────────────────
    op.create_table(
        'protheus_lancctb_ct2',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ct2_filial', sa.String(8), nullable=False, default=''),
        sa.Column('ct2_lote', sa.String(6), nullable=False),
        sa.Column('ct2_grpme', sa.String(3), nullable=False, comment='Sub-lote'),
        sa.Column('ct2_seq', sa.String(5), nullable=False, comment='Sequencia'),
        sa.Column('ct2_data', sa.Date(), nullable=True),
        sa.Column('ct2_debito', sa.String(20), nullable=True, comment='Conta debito CTD'),
        sa.Column('ct2_credit', sa.String(20), nullable=True, comment='Conta credito CTD'),
        sa.Column('ct2_valor', sa.Numeric(15, 4), nullable=True),
        sa.Column('ct2_histo', sa.String(200), nullable=True, comment='Historico contabil'),
        sa.Column('ct2_doc', sa.String(9), nullable=True),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ct2_filial', 'ct2_lote', 'ct2_grpme', 'ct2_seq', name='uq_ct2_lancamento'),
        comment='Lancamentos Contabeis do Protheus (CT2)'
    )
    op.create_index('ix_protheus_lancctb_ct2_data', 'protheus_lancctb_ct2', ['ct2_data'])
    op.create_index('ix_protheus_lancctb_ct2_debito', 'protheus_lancctb_ct2', ['ct2_debito'])
    op.create_index('ix_protheus_lancctb_ct2_credit', 'protheus_lancctb_ct2', ['ct2_credit'])

    # ── SRA ── Funcionarios (RH/SIGAGPE) ────────────────────────────────────
    op.create_table(
        'protheus_funcionarios_sra',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ra_filial', sa.String(8), nullable=False, default=''),
        sa.Column('ra_mat', sa.String(6), nullable=False, comment='Matricula'),
        sa.Column('ra_nome', sa.String(40), nullable=True),
        sa.Column('ra_cpf', sa.String(11), nullable=True),
        sa.Column('ra_admissa', sa.Date(), nullable=True, comment='Data admissao'),
        sa.Column('ra_demissa', sa.Date(), nullable=True, comment='Data demissao'),
        sa.Column('ra_cargfun', sa.String(20), nullable=True, comment='Cargo'),
        sa.Column('ra_cc', sa.String(9), nullable=True, comment='Centro de custo CTT'),
        sa.Column('ra_sitfolh', sa.String(1), nullable=True, comment='A=Ativo D=Demitido F=Ferias'),
        sa.Column('d_e_l_e_t_', sa.String(1), nullable=False, default=' '),
        sa.Column('r_e_c_n_o_', sa.BigInteger(), nullable=True),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ra_filial', 'ra_mat', name='uq_sra_filial_mat'),
        comment='Funcionarios do Protheus SIGAGPE (SRA)'
    )
    op.create_index('ix_protheus_funcionarios_sra_mat', 'protheus_funcionarios_sra', ['ra_mat'])
    op.create_index('ix_protheus_funcionarios_sra_sitfolh', 'protheus_funcionarios_sra', ['ra_sitfolh'])

    # ── Log de Sincronizacao ────────────────────────────────────────────────
    op.create_table(
        'protheus_sync_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('tabela_protheus', sa.String(10), nullable=False, comment='Ex: SA1, SB1, SE1'),
        sa.Column('tabela_local', sa.String(60), nullable=False, comment='Nome da tabela PostgreSQL'),
        sa.Column('operacao', sa.String(20), nullable=False, comment='full_sync | incremental | check'),
        sa.Column('registros_lidos', sa.Integer(), nullable=True),
        sa.Column('registros_inseridos', sa.Integer(), nullable=True),
        sa.Column('registros_atualizados', sa.Integer(), nullable=True),
        sa.Column('registros_ignorados', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(10), nullable=False, comment='success | error | running'),
        sa.Column('erro_mensagem', sa.Text(), nullable=True),
        sa.Column('iniciado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('finalizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duracao_segundos', sa.Integer(), nullable=True),
        sa.Column('executado_por', sa.String(40), nullable=True, comment='usuario ou job'),
        sa.PrimaryKeyConstraint('id'),
        comment='Log de sincronizacoes entre Protheus e PostgreSQL'
    )
    op.create_index('ix_protheus_sync_log_tabela', 'protheus_sync_log', ['tabela_protheus'])
    op.create_index('ix_protheus_sync_log_status', 'protheus_sync_log', ['status'])
    op.create_index('ix_protheus_sync_log_iniciado', 'protheus_sync_log', ['iniciado_em'])


def downgrade() -> None:
    op.drop_table('protheus_sync_log')
    op.drop_table('protheus_funcionarios_sra')
    op.drop_table('protheus_lancctb_ct2')
    op.drop_table('protheus_movest_sd3')
    op.drop_table('protheus_itemnf_sd2')
    op.drop_table('protheus_nfsaida_sf2')
    op.drop_table('protheus_ctapagar_se2')
    op.drop_table('protheus_ctareceber_se1')
    op.drop_table('protheus_itenspedido_sc6')
    op.drop_table('protheus_pedidos_sc5')
    op.drop_table('protheus_saldos_sb2')
    op.drop_table('protheus_produtos_sb1')
    op.drop_table('protheus_clientes_sa1')
    op.drop_table('protheus_consultas_sxb')
    op.drop_table('protheus_campos_sx3')
    op.drop_table('protheus_tabelas_sx2')
