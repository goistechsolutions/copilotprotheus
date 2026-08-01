"""Protheus SXG - Grupos de Campos e Auditoria de Divergencias

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-01

Tabelas criadas:
  - protheus_grupos_sxg       : Grupos de campos com tamanhos canonicos TOTVS (SXG)
  - protheus_divergencias_sxg : Log de divergencias detectadas entre SXG e SX3

Motivo:
  O SXG define os tamanhos canonicos (padrao TOTVS) para grupos de campos
  reutilizados em multiplas tabelas. Ex: o grupo GRU_CLIFOR define que
  o campo Codigo do Cliente/Fornecedor tem sempre 6 caracteres.

  Sem essa tabela nao e possivel:
    - Detectar campos customizados com tamanho divergente do padrao TOTVS
    - Auditar customizacoes que podem quebrar integracoes e upgrades
    - Validar se um campo em SX3 respeita o grupo ao qual pertence (X3_GRPSXG)
    - Identificar risco antes de um update de release (ex: campo alargado que
      pode colidir com o novo tamanho padrao da TOTVS)

  Fluxo de uso:
    1. Sincronizar SXG  -> protheus_grupos_sxg       (via API Protheus)
    2. Sincronizar SX3  -> protheus_campos_sx3        (ja existe em 0002)
    3. Executar query de auditoria abaixo
    4. Registrar resultados em protheus_divergencias_sxg
    5. Expor via API FastAPI para dashboard de saude do dicionario

  Query de auditoria (executar apos sincronizacao):
  -----------------------------------------------------------------------
  SELECT
      sx3.x3_arquivo,
      sx3.x3_campo,
      sx3.x3_grpsxg,
      sx3.x3_tipo        AS tipo_atual,
      sxg.gru_tipo       AS tipo_canonico,
      sx3.x3_tamanho     AS tamanho_atual,
      sxg.gru_tamanho    AS tamanho_canonico,
      sx3.x3_decimal     AS decimal_atual,
      sxg.gru_decimal    AS decimal_canonico,
      CASE
          WHEN sx3.x3_tipo    != sxg.gru_tipo    THEN 'CRITICA'
          WHEN sx3.x3_tamanho <  sxg.gru_tamanho THEN 'ALTA'
          WHEN sx3.x3_tamanho >  sxg.gru_tamanho THEN 'MEDIA'
          WHEN sx3.x3_decimal != sxg.gru_decimal  THEN 'BAIXA'
      END AS severidade
  FROM protheus_campos_sx3 sx3
  JOIN protheus_grupos_sxg sxg
    ON sx3.x3_grpsxg = sxg.gru_grupo
  WHERE sx3.x3_grpsxg IS NOT NULL
    AND sx3.x3_grpsxg != ''
    AND (
          sx3.x3_tipo    != sxg.gru_tipo    OR
          sx3.x3_tamanho != sxg.gru_tamanho OR
          sx3.x3_decimal != sxg.gru_decimal
        )
  ORDER BY severidade, sx3.x3_arquivo, sx3.x3_campo;
  -----------------------------------------------------------------------

  Severidades:
    CRITICA  : tipo divergente  - pode causar erros de conversao de dados
    ALTA     : tamanho MENOR que padrao - risco de truncamento em upgrade
    MEDIA    : tamanho MAIOR que padrao - customizacao intencional
    BAIXA    : decimal divergente - pode afetar arredondamentos
    INFO     : campo sem grupo definido - apenas registro informativo

  Regras aplicadas (conforme Tabelas-de-referencia.pdf):
    - D_E_L_E_T_ presente em todas as tabelas de dados
    - R_E_C_N_O_ presente como referencia de chave fisica
    - Nunca usar INSERT/UPDATE/DELETE direto no Protheus
    - Sempre filtrar D_E_L_E_T_ = ' ' ao sincronizar
"""

from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── SXG ── Grupos de Campos (tamanhos canonicos TOTVS) ──────────────────
    #
    # O SXG e o "gabarito" oficial da TOTVS para tamanhos de campos
    # compartilhados entre tabelas. Cada grupo define o tamanho canonico,
    # decimal canonico e tipo de dado padrao.
    #
    # Exemplos de grupos criticos:
    #   GRU_CLIFOR  : Codigo Cliente/Fornecedor -> 6 chars
    #   GRU_PRODUTO : Codigo Produto            -> 15 chars (20 no P12.1.27+)
    #   GRU_LOJA    : Loja                      -> 2 chars
    #   GRU_FILIAL  : Filial                    -> 8 chars
    #   GRU_DOC     : Numero Documento          -> 9 chars
    #   GRU_CCUSTO  : Centro de Custo           -> 9 chars
    #   GRU_CONTA   : Conta Contabil            -> 20 chars
    #   GRU_MOEDA   : Moeda                     -> 3 chars
    # ────────────────────────────────────────────────────────────────────────
    op.create_table(
        'protheus_grupos_sxg',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),

        # ── Identificacao do grupo ──────────────────────────────────────────
        sa.Column('gru_grupo',   sa.String(20),  nullable=False,
                  comment='Nome do grupo ex: GRU_CLIFOR GRU_PRODUTO GRU_FILIAL'),
        sa.Column('gru_descric', sa.String(80),  nullable=True,
                  comment='Descricao legivel do grupo para humanos'),

        # ── Definicao canonica (padrao TOTVS) ──────────────────────────────
        sa.Column('gru_tipo',    sa.String(1),   nullable=True,
                  comment='C=Caracter N=Numerico D=Data L=Logico M=Memo'),
        sa.Column('gru_tamanho', sa.Integer(),   nullable=True,
                  comment='Tamanho canonico padrao TOTVS - referencia para auditoria'),
        sa.Column('gru_decimal', sa.Integer(),   nullable=True,
                  comment='Casas decimais canonicas padrao TOTVS'),

        # ── Mascara e validacao ─────────────────────────────────────────────
        sa.Column('gru_picture', sa.String(40),  nullable=True,
                  comment='Mascara de formatacao PICTURE padrao'),
        sa.Column('gru_valid',   sa.Text(),      nullable=True,
                  comment='Validacao ADVPL padrao do grupo'),
        sa.Column('gru_ini',     sa.String(20),  nullable=True,
                  comment='Valor inicial padrao'),

        # ── Contexto e modulo ───────────────────────────────────────────────
        sa.Column('gru_modulo',  sa.String(20),  nullable=True,
                  comment='Modulo proprietario: SIGAFAT SIGAEST SIGAFIN SIGAFIS etc.'),
        sa.Column('gru_used',    sa.String(1),   nullable=True,
                  comment='S=Em uso N=Obsoleto'),

        # ── Controle Protheus ───────────────────────────────────────────────
        sa.Column('d_e_l_e_t_',  sa.String(1),   nullable=False, server_default=' ',
                  comment='Flag delecao logica Protheus: *=deletado espaco=ativo'),
        sa.Column('r_e_c_n_o_',  sa.BigInteger(), nullable=True,
                  comment='Chave fisica do registro no Protheus - nao usar como negocio'),
        sa.Column('sincronizado_em', sa.DateTime(timezone=True), nullable=True,
                  comment='Ultima sincronizacao com o dicionario Protheus'),
        sa.Column('criado_em',   sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gru_grupo', name='uq_sxg_grupo'),
        comment='Grupos de Campos do Protheus (SXG) - tamanhos canonicos para auditoria de divergencias'
    )
    op.create_index('ix_protheus_grupos_sxg_grupo',    'protheus_grupos_sxg', ['gru_grupo'])
    op.create_index('ix_protheus_grupos_sxg_tipo',     'protheus_grupos_sxg', ['gru_tipo'])
    op.create_index('ix_protheus_grupos_sxg_modulo',   'protheus_grupos_sxg', ['gru_modulo'])
    op.create_index('ix_protheus_grupos_sxg_used',     'protheus_grupos_sxg', ['gru_used'])
    op.create_index('ix_protheus_grupos_sxg_deletado', 'protheus_grupos_sxg', ['d_e_l_e_t_'])


    # ── DIVERGENCIAS SXG vs SX3 ─────────────────────────────────────────────
    #
    # Tabela de log gerada pelo processo de auditoria automatica que compara:
    #   protheus_campos_sx3.x3_tamanho  (tamanho atual do campo no ambiente)
    #   protheus_grupos_sxg.gru_tamanho (tamanho canonico padrao TOTVS)
    #
    # Uma divergencia ocorre quando qualquer um dos valores difere:
    #   tipo     : x3_tipo    != gru_tipo    -> CRITICA
    #   tamanho  : x3_tamanho <  gru_tamanho -> ALTA    (risco truncamento)
    #   tamanho  : x3_tamanho >  gru_tamanho -> MEDIA   (customizacao)
    #   decimal  : x3_decimal != gru_decimal  -> BAIXA
    # ────────────────────────────────────────────────────────────────────────
    op.create_table(
        'protheus_divergencias_sxg',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),

        # ── Referencia ao campo divergente ─────────────────────────────────
        sa.Column('x3_arquivo',   sa.String(10),  nullable=False,
                  comment='Tabela dona do campo divergente (ex: SB1)'),
        sa.Column('x3_campo',     sa.String(30),  nullable=False,
                  comment='Nome do campo divergente (ex: B1_COD)'),
        sa.Column('x3_grpsxg',    sa.String(20),  nullable=True,
                  comment='Grupo SXG ao qual o campo pertence'),
        sa.Column('x3_titulo',    sa.String(80),  nullable=True,
                  comment='Label do campo para leitura humana'),

        # ── Valores detectados vs canonicos ────────────────────────────────
        sa.Column('tipo_atual',           sa.String(1),  nullable=True,
                  comment='Tipo atual no SX3'),
        sa.Column('tipo_canonico',        sa.String(1),  nullable=True,
                  comment='Tipo canonico no SXG'),
        sa.Column('tamanho_atual',        sa.Integer(),  nullable=True,
                  comment='Tamanho atual no SX3'),
        sa.Column('tamanho_canonico',     sa.Integer(),  nullable=True,
                  comment='Tamanho canonico no SXG'),
        sa.Column('decimal_atual',        sa.Integer(),  nullable=True,
                  comment='Decimal atual no SX3'),
        sa.Column('decimal_canonico',     sa.Integer(),  nullable=True,
                  comment='Decimal canonico no SXG'),
        sa.Column('diferenca_tamanho',    sa.Integer(),  nullable=True,
                  comment='tamanho_atual - tamanho_canonico: negativo=risco truncamento'),

        # ── Classificacao da divergencia ────────────────────────────────────
        sa.Column('severidade',       sa.String(10),  nullable=False,
                  comment='CRITICA | ALTA | MEDIA | BAIXA | INFO'),
        sa.Column('tipo_divergencia', sa.String(20),  nullable=False,
                  comment='TIPO | TAMANHO_MENOR | TAMANHO_MAIOR | DECIMAL | SEM_GRUPO'),
        sa.Column('descricao',        sa.Text(),      nullable=True,
                  comment='Descricao detalhada gerada automaticamente'),
        sa.Column('recomendacao',     sa.Text(),      nullable=True,
                  comment='Acao recomendada: aceitar customizacao ou corrigir'),

        # ── Status de tratamento ────────────────────────────────────────────
        sa.Column('status',        sa.String(20),  nullable=False, server_default='ABERTA',
                  comment='ABERTA | ACEITA | CORRIGIDA | IGNORADA'),
        sa.Column('justificativa', sa.Text(),      nullable=True,
                  comment='Justificativa tecnica quando aceita ou ignorada'),
        sa.Column('tratado_por',   sa.String(60),  nullable=True,
                  comment='Usuario ou job que tratou a divergencia'),
        sa.Column('tratado_em',    sa.DateTime(timezone=True), nullable=True),

        # ── Controle de auditoria ───────────────────────────────────────────
        sa.Column('detectado_em',     sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False,
                  comment='Quando a divergencia foi detectada pela primeira vez'),
        sa.Column('release_protheus', sa.String(20), nullable=True,
                  comment='Release Protheus no momento da deteccao ex: 12.1.2310'),
        sa.Column('hash_divergencia', sa.String(64), nullable=True,
                  comment='Hash SHA256 de arquivo+campo+tipo_diverg para deduplicacao'),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('x3_arquivo', 'x3_campo', 'tipo_divergencia',
                            name='uq_diverg_campo_tipo'),
        comment='Divergencias detectadas entre SX3 (customizado) e SXG (canonico TOTVS)'
    )
    op.create_index('ix_diverg_sxg_arquivo',    'protheus_divergencias_sxg', ['x3_arquivo'])
    op.create_index('ix_diverg_sxg_campo',      'protheus_divergencias_sxg', ['x3_campo'])
    op.create_index('ix_diverg_sxg_grupo',      'protheus_divergencias_sxg', ['x3_grpsxg'])
    op.create_index('ix_diverg_sxg_severidade', 'protheus_divergencias_sxg', ['severidade'])
    op.create_index('ix_diverg_sxg_status',     'protheus_divergencias_sxg', ['status'])
    op.create_index('ix_diverg_sxg_detectado',  'protheus_divergencias_sxg', ['detectado_em'])
    op.create_index('ix_diverg_sxg_hash',       'protheus_divergencias_sxg', ['hash_divergencia'])
    # Indice composto para dashboard: filtrar por severidade+status
    op.create_index('ix_diverg_sxg_sev_status', 'protheus_divergencias_sxg',
                    ['severidade', 'status'])


def downgrade() -> None:
    op.drop_table('protheus_divergencias_sxg')
    op.drop_table('protheus_grupos_sxg')
