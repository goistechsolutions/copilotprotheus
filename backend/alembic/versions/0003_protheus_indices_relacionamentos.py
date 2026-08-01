"""Protheus SIX e SX9 - Indices e Relacionamentos do Dicionario de Dados

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-01

Tabelas criadas:
  - protheus_indices_six   : Indices fisicos das tabelas (SIX) - chave para performance de queries
  - protheus_relac_sx9     : Relacionamentos logicos entre tabelas (SX9) - base para JOINs corretos

Motivo:
  SIX e SX9 sao tabelas estruturais criticas do dicionario de dados Protheus.
  Sem elas nao e possivel:
    - Saber quais indices existem antes de escrever queries custosas
    - Conhecer os joins logicos entre tabelas (ex: SC5 -> SA1 pelo campo C5_CLIENTE)
    - Validar se uma query usara ou nao indice no Top Connect / DBAccess

Regras aplicadas (conforme Tabelas-de-referencia.pdf):
  - D_E_L_E_T_ presente em todas as tabelas de dados
  - xx_FILIAL como primeira coluna de negocio
  - R_E_C_N_O_ presente como referencia de chave fisica
  - Nunca usar INSERT/UPDATE/DELETE direto — sincronizar via API Protheus
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── SIX ── Indices Fisicos das Tabelas ──────────────────────────────────
    # A SIX lista todos os indices de cada tabela Protheus.
    # CRITICA para performance: sempre consulte a SIX antes de escrever
    # queries com WHERE ou ORDER BY para garantir uso de indice.
    #
    # Campos principais:
    #   INDICE    : alias da tabela (ex: SB1, SA1, SC5)
    #   ORDEM     : numero da ordem do indice (1=primario, 2=secundario...)
    #   CHAVE     : expressao do indice (ex: B1_FILIAL+B1_COD)
    #   DESCRICAO : descricao legivel do indice
    #   PROPRIED  : U=Unico N=Nao unico
    #   SHOWPESQ  : S=Aparece no atalho de pesquisa F3
    # ────────────────────────────────────────────────────────────────────────
    op.create_table(
        'protheus_indices_six',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),

        # ── Identificacao do indice ──────────────────────────────────────────
        sa.Column('indice',     sa.String(10),  nullable=False,
                  comment='Alias da tabela dona do indice (ex: SB1, SA1, SC5)'),
        sa.Column('ordem',      sa.String(2),   nullable=False,
                  comment='Ordem do indice: 1=primario 2=secundario etc.'),

        # ── Definicao tecnica ────────────────────────────────────────────────
        sa.Column('chave',      sa.String(200), nullable=True,
                  comment='Expressao do indice ex: B1_FILIAL+B1_COD — campos concatenados'),
        sa.Column('descricao',  sa.String(80),  nullable=True,
                  comment='Descricao legivel do indice para humanos'),
        sa.Column('propried',   sa.String(1),   nullable=True,
                  comment='U=Unico (unique) N=Nao unico — impacta integridade'),

        # ── Comportamento visual ──────────────────────────────────────────────
        sa.Column('showpesq',   sa.String(1),   nullable=True,
                  comment='S=Aparece no atalho de pesquisa F3 N=Nao aparece'),
        sa.Column('nickname',   sa.String(30),  nullable=True,
                  comment='Apelido do indice para identificacao rapida'),

        # ── Campos adicionais do ambiente Protheus ──────────────────────────
        sa.Column('modulo',     sa.String(20),  nullable=True,
                  comment='Modulo proprietario: SIGAFAT SIGAEST SIGAFIN etc.'),
        sa.Column('expressao',  sa.Text(),      nullable=True,
                  comment='Expressao completa incluindo filtros condicionais ADVPL'),

        # ── Controle de sincronizacao ────────────────────────────────────────
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True,
                  comment='Ultima sincronizacao com o dicionario Protheus'),
        sa.Column('criado_em',  sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('indice', 'ordem', name='uq_six_indice_ordem'),
        comment='Indices fisicos das tabelas Protheus (SIX) — consulte antes de escrever queries'
    )
    # Indice por alias de tabela — busca mais comum
    op.create_index('ix_protheus_indices_six_indice',   'protheus_indices_six', ['indice'])
    # Indice por propriedade — filtrar apenas unicos
    op.create_index('ix_protheus_indices_six_propried', 'protheus_indices_six', ['propried'])
    # Indice por showpesq — saber quais aparecem no F3
    op.create_index('ix_protheus_indices_six_showpesq', 'protheus_indices_six', ['showpesq'])


    # ── SX9 ── Relacionamentos entre Tabelas (Joins Logicos) ─────────────────
    # A SX9 define os relacionamentos logicos entre tabelas do Protheus.
    # Essencial para construir JOINs corretos sem adivinhar os campos.
    #
    # Campos principais:
    #   X9_ARQUIVO : tabela origem (ex: SC5 - Pedidos)
    #   X9_ARQUIV2 : tabela destino (ex: SA1 - Clientes)
    #   X9_COND    : condicao do join em ADVPL (ex: SC5->C5_CLIENTE==SA1->A1_COD)
    #   X9_RELACAO : tipo de relacao 1=1:1  2=1:N  3=N:N
    #   X9_CAMPO   : campo origem que faz o join
    #   X9_CAMPO2  : campo destino que recebe o join
    #   X9_PROPRI  : propriedade do relacionamento
    #
    # Exemplos de relacionamentos criticos:
    #   SC5 -> SA1  : Pedido de Venda -> Cliente  (C5_CLIENTE = A1_COD)
    #   SC6 -> SB1  : Item Pedido     -> Produto  (C6_PRODUTO = B1_COD)
    #   SD2 -> SB1  : Item NF         -> Produto  (D2_COD     = B1_COD)
    #   SE1 -> SA1  : Conta Receber   -> Cliente  (E1_CLIENTE = A1_COD)
    #   SE2 -> SA2  : Conta Pagar     -> Fornec   (E2_FORNECE = A2_COD)
    #   CT2 -> CTD  : Lancto Contabil -> Plano    (CT2_DEBITO = CTD_CONTA)
    # ────────────────────────────────────────────────────────────────────────
    op.create_table(
        'protheus_relac_sx9',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),

        # ── Identificacao do relacionamento ──────────────────────────────────
        sa.Column('x9_arquivo',  sa.String(10), nullable=False,
                  comment='Tabela ORIGEM do relacionamento (ex: SC5)'),
        sa.Column('x9_arquiv2',  sa.String(10), nullable=False,
                  comment='Tabela DESTINO do relacionamento (ex: SA1)'),
        sa.Column('x9_seq',      sa.String(3),  nullable=True,
                  comment='Sequencia quando ha multiplos relacionamentos entre o mesmo par'),

        # ── Definicao do join ────────────────────────────────────────────────
        sa.Column('x9_campo',    sa.String(30), nullable=True,
                  comment='Campo ORIGEM que participa do join (ex: C5_CLIENTE)'),
        sa.Column('x9_campo2',   sa.String(30), nullable=True,
                  comment='Campo DESTINO que recebe o join (ex: A1_COD)'),
        sa.Column('x9_cond',     sa.Text(),     nullable=True,
                  comment='Condicao completa do join em ADVPL — expressao logica'),
        sa.Column('x9_expres',   sa.Text(),     nullable=True,
                  comment='Expressao complementar de filtragem'),

        # ── Tipo e propriedades ──────────────────────────────────────────────
        sa.Column('x9_relacao',  sa.String(1),  nullable=True,
                  comment='Cardinalidade: 1=Um-para-Um  2=Um-para-Muitos  3=Muitos-para-Muitos'),
        sa.Column('x9_propri',   sa.String(1),  nullable=True,
                  comment='Propriedade do relacionamento: O=Obrigatorio F=Facultativo'),
        sa.Column('x9_label',    sa.String(80), nullable=True,
                  comment='Label descritivo do relacionamento para leitura humana'),

        # ── Modulo e contexto ────────────────────────────────────────────────
        sa.Column('x9_modulo',   sa.String(20), nullable=True,
                  comment='Modulo proprietario: SIGAFAT SIGAEST SIGAFIN etc.'),

        # ── Controle de sincronizacao ────────────────────────────────────────
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True,
                  comment='Ultima sincronizacao com o dicionario Protheus'),
        sa.Column('criado_em',   sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('x9_arquivo', 'x9_arquiv2', 'x9_seq',
                            name='uq_sx9_origem_destino_seq'),
        comment='Relacionamentos logicos entre tabelas Protheus (SX9) — base para JOINs corretos'
    )
    # Indice por tabela origem — consulta "quais tabelas SC5 se relaciona?"
    op.create_index('ix_protheus_relac_sx9_arquivo',  'protheus_relac_sx9', ['x9_arquivo'])
    # Indice por tabela destino — consulta "quem referencia SA1?"
    op.create_index('ix_protheus_relac_sx9_arquiv2',  'protheus_relac_sx9', ['x9_arquiv2'])
    # Indice por campo origem — localizar por campo especifico
    op.create_index('ix_protheus_relac_sx9_campo',    'protheus_relac_sx9', ['x9_campo'])
    # Indice por tipo de relacao — filtrar apenas 1:N por exemplo
    op.create_index('ix_protheus_relac_sx9_relacao',  'protheus_relac_sx9', ['x9_relacao'])
    # Indice composto origem+destino — join direto sem seq
    op.create_index('ix_protheus_relac_sx9_par',      'protheus_relac_sx9',
                    ['x9_arquivo', 'x9_arquiv2'])


def downgrade() -> None:
    op.drop_table('protheus_relac_sx9')
    op.drop_table('protheus_indices_six')
