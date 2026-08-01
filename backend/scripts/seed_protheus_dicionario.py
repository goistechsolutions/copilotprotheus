#!/usr/bin/env python3
"""
Seed inicial do dicionario SX2/SX3 com as principais tabelas Protheus.

Uso:
    cd backend
    python scripts/seed_protheus_dicionario.py

Requer DATABASE_URL no .env ou variavel de ambiente.
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from sqlalchemy import create_engine, text
    from dotenv import load_dotenv
except ImportError:
    print("[ERRO] Instale: pip install sqlalchemy python-dotenv")
    sys.exit(1)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    print("[ERRO] DATABASE_URL nao configurada.")
    sys.exit(1)

# Troca prefixo asyncpg por psycopg2 se necessario
DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql").replace("postgresql+aiosqlite", "sqlite")

engine = create_engine(DATABASE_URL, echo=False)

# ─── Dados SX2: tabelas de referencia ───────────────────────────────────────
TABELAS_SX2 = [
    # chave   nome                              modo  modulo
    ("SX2",  "Dicionario de Tabelas",           "C",  "FRAMEWORK"),
    ("SX3",  "Dicionario de Campos",             "C",  "FRAMEWORK"),
    ("SX7",  "Gatilhos",                         "C",  "FRAMEWORK"),
    ("SX9",  "Relacionamentos entre Tabelas",    "C",  "FRAMEWORK"),
    ("SXB",  "Consultas Padrao F3",              "C",  "FRAMEWORK"),
    ("SXG",  "Grupos de Campos",                 "C",  "FRAMEWORK"),
    ("SA1",  "Clientes",                         "E",  "SIGAFAT"),
    ("SA2",  "Fornecedores",                     "E",  "SIGACOM"),
    ("SA3",  "Vendedores",                       "E",  "SIGAFAT"),
    ("SB1",  "Produtos",                         "C",  "SIGAEST"),
    ("SB2",  "Saldos em Estoque",                "E",  "SIGAEST"),
    ("SB9",  "Saldos Iniciais de Estoque",       "E",  "SIGAEST"),
    ("SC1",  "Solicitacoes de Compra",           "E",  "SIGACOM"),
    ("SC2",  "Ordens de Producao",               "E",  "SIGAPCP"),
    ("SC5",  "Pedidos de Venda - Cabecalho",     "E",  "SIGAFAT"),
    ("SC6",  "Pedidos de Venda - Itens",         "E",  "SIGAFAT"),
    ("SD1",  "Itens de NF de Entrada",           "E",  "SIGACOM"),
    ("SD2",  "Itens de NF de Saida",             "E",  "SIGAFAT"),
    ("SD3",  "Movimentos de Estoque",            "E",  "SIGAEST"),
    ("SE1",  "Contas a Receber",                 "E",  "SIGAFIN"),
    ("SE2",  "Contas a Pagar",                   "E",  "SIGAFIN"),
    ("SE5",  "Movimento Bancario",               "E",  "SIGAFIN"),
    ("SF1",  "Notas Fiscais de Entrada",         "E",  "SIGACOM"),
    ("SF2",  "Notas Fiscais de Saida",           "E",  "SIGAFAT"),
    ("SF4",  "Tipo de Entrada e Saida (TES)",    "C",  "SIGAFAT"),
    ("SRA",  "Funcionarios",                     "E",  "SIGAGPE"),
    ("SRC",  "Verbas",                           "E",  "SIGAGPE"),
    ("CT2",  "Lancamentos Contabeis",            "E",  "SIGACTB"),
    ("CTD",  "Plano de Contas",                  "E",  "SIGACTB"),
    ("CTT",  "Centros de Custo",                 "E",  "SIGACTB"),
]

# ─── Campos chave por tabela (amostra SX3) ──────────────────────────────────
CAMPOS_SX3 = [
    # arquivo  campo          tipo  tam  dec  titulo
    ("SA1",  "A1_FILIAL",   "C",  8,   0,  "Filial"),
    ("SA1",  "A1_COD",      "C",  6,   0,  "Codigo"),
    ("SA1",  "A1_LOJA",     "C",  2,   0,  "Loja"),
    ("SA1",  "A1_NOME",     "C",  40,  0,  "Razao Social"),
    ("SA1",  "A1_NREDUZ",   "C",  20,  0,  "Nome Reduzido"),
    ("SA1",  "A1_CNPJ",     "C",  18,  0,  "CNPJ"),
    ("SA1",  "A1_TIPO",     "C",  1,   0,  "Tipo F/J"),
    ("SA1",  "A1_MSBLQL",   "C",  1,   0,  "Bloqueado"),
    ("SB1",  "B1_FILIAL",   "C",  8,   0,  "Filial"),
    ("SB1",  "B1_COD",      "C",  15,  0,  "Codigo"),
    ("SB1",  "B1_DESC",     "C",  60,  0,  "Descricao"),
    ("SB1",  "B1_UM",       "C",  2,   0,  "Unidade Medida"),
    ("SB1",  "B1_TIPO",     "C",  2,   0,  "Tipo Produto"),
    ("SB1",  "B1_GRUPO",    "C",  4,   0,  "Grupo"),
    ("SB1",  "B1_RASTRO",   "C",  1,   0,  "Rastreavel"),
    ("SB2",  "B2_COD",      "C",  15,  0,  "Produto"),
    ("SB2",  "B2_LOCAL",    "C",  6,   0,  "Almoxarifado"),
    ("SB2",  "B2_QATU",     "N",  15,  4,  "Saldo Atual"),
    ("SB2",  "B2_QEMP",     "N",  15,  4,  "Qtd Empenhada"),
    ("SB2",  "B2_CM",       "N",  15,  4,  "Custo Medio"),
    ("SE1",  "E1_NUM",      "C",  9,   0,  "Numero Titulo"),
    ("SE1",  "E1_PARCELA",  "C",  2,   0,  "Parcela"),
    ("SE1",  "E1_CLIENTE",  "C",  6,   0,  "Cliente"),
    ("SE1",  "E1_VENCTO",   "D",  8,   0,  "Vencimento"),
    ("SE1",  "E1_VALOR",    "N",  15,  4,  "Valor"),
    ("SE1",  "E1_SALDO",    "N",  15,  4,  "Saldo"),
    ("SE1",  "E1_SITUACA",  "C",  1,   0,  "Situacao"),
    ("SE2",  "E2_NUM",      "C",  9,   0,  "Numero Titulo"),
    ("SE2",  "E2_PARCELA",  "C",  2,   0,  "Parcela"),
    ("SE2",  "E2_FORNECE",  "C",  6,   0,  "Fornecedor"),
    ("SE2",  "E2_VENCTO",   "D",  8,   0,  "Vencimento"),
    ("SE2",  "E2_VALOR",    "N",  15,  4,  "Valor"),
    ("SE2",  "E2_SALDO",    "N",  15,  4,  "Saldo"),
    ("SE2",  "E2_SITUACA",  "C",  1,   0,  "Situacao"),
    ("SF2",  "F2_DOC",      "C",  9,   0,  "Numero NF"),
    ("SF2",  "F2_SERIE",    "C",  3,   0,  "Serie"),
    ("SF2",  "F2_CLIENTE",  "C",  6,   0,  "Cliente"),
    ("SF2",  "F2_EMISSAO",  "D",  8,   0,  "Emissao"),
    ("SF2",  "F2_VALBRUT",  "N",  15,  4,  "Valor Bruto"),
    ("SF2",  "F2_CHVNFE",   "C",  44,  0,  "Chave NFe"),
    ("CT2",  "CT2_LOTE",    "C",  6,   0,  "Lote Contabil"),
    ("CT2",  "CT2_DATA",    "D",  8,   0,  "Data Lancamento"),
    ("CT2",  "CT2_DEBITO",  "C",  20,  0,  "Conta Debito"),
    ("CT2",  "CT2_CREDIT",  "C",  20,  0,  "Conta Credito"),
    ("CT2",  "CT2_VALOR",   "N",  15,  4,  "Valor"),
    ("SRA",  "RA_MAT",      "C",  6,   0,  "Matricula"),
    ("SRA",  "RA_NOME",     "C",  40,  0,  "Nome"),
    ("SRA",  "RA_CPF",      "C",  11,  0,  "CPF"),
    ("SRA",  "RA_ADMISSA",  "D",  8,   0,  "Data Admissao"),
    ("SRA",  "RA_SITFOLH",  "C",  1,   0,  "Situacao Folha"),
]

NOW = datetime.now(timezone.utc)


def seed_sx2(conn):
    print("[SX2] Inserindo tabelas de referencia...")
    for chave, nome, modo, modulo in TABELAS_SX2:
        conn.execute(text("""
            INSERT INTO protheus_tabelas_sx2
                (x2_chave, x2_nome, x2_modo, x2_modulo, sincronizado_em)
            VALUES
                (:chave, :nome, :modo, :modulo, :now)
            ON CONFLICT (x2_chave) DO UPDATE
                SET x2_nome = EXCLUDED.x2_nome,
                    x2_modo = EXCLUDED.x2_modo,
                    x2_modulo = EXCLUDED.x2_modulo,
                    sincronizado_em = EXCLUDED.sincronizado_em
        """), {"chave": chave, "nome": nome, "modo": modo, "modulo": modulo, "now": NOW})
    print(f"  -> {len(TABELAS_SX2)} tabelas inseridas/atualizadas.")


def seed_sx3(conn):
    print("[SX3] Inserindo campos do dicionario...")
    for arquivo, campo, tipo, tam, dec, titulo in CAMPOS_SX3:
        conn.execute(text("""
            INSERT INTO protheus_campos_sx3
                (x3_arquivo, x3_campo, x3_tipo, x3_tamanho, x3_decimal, x3_titulo,
                 x3_usado, sincronizado_em)
            VALUES
                (:arquivo, :campo, :tipo, :tam, :dec, :titulo, 'S', :now)
            ON CONFLICT (x3_arquivo, x3_campo) DO UPDATE
                SET x3_tipo = EXCLUDED.x3_tipo,
                    x3_tamanho = EXCLUDED.x3_tamanho,
                    x3_decimal = EXCLUDED.x3_decimal,
                    x3_titulo = EXCLUDED.x3_titulo,
                    sincronizado_em = EXCLUDED.sincronizado_em
        """), {
            "arquivo": arquivo, "campo": campo, "tipo": tipo,
            "tam": tam, "dec": dec, "titulo": titulo, "now": NOW
        })
    print(f"  -> {len(CAMPOS_SX3)} campos inseridos/atualizados.")


if __name__ == "__main__":
    print(f"Conectando em: {DATABASE_URL[:40]}...")
    with engine.connect() as conn:
        seed_sx2(conn)
        seed_sx3(conn)
        conn.commit()
    print("[OK] Seed concluido com sucesso.")
