import pytest

from app.core.sql_guard import validate_readonly_oracle_sql as guard

OK = [
    "SELECT E1_CLIENTE, SUM(E1_SALDO) AS T FROM SE1010 WHERE D_E_L_E_T_ <> '*' GROUP BY E1_CLIENTE",
    "WITH x AS (SELECT A1_COD FROM SA1010 WHERE D_E_L_E_T_ = ' ') SELECT A1_COD FROM x",
    "SELECT COUNT(*) FROM SE1010 WHERE D_E_L_E_T_ <> '*'",
    "SELECT E1_NUM FROM SE1010 WHERE D_E_L_E_T_ <> '*' ORDER BY E1_NUM FETCH FIRST 10 ROWS ONLY",
    "SELECT E1_NUM FROM (SELECT E1_NUM FROM SE1010 WHERE D_E_L_E_T_ <> '*' ORDER BY E1_NUM) WHERE ROWNUM <= 5",
]

BAD = {
    "UPDATE SE1010 SET D_E_L_E_T_='*'": "not_select",
    "SELECT 1 FROM DUAL WHERE D_E_L_E_T_=' ';\nUPDATE\tSE1010 SET E1_SALDO=0": "multiple_statements",
    "MERGE INTO SE1010 t USING DUAL ON (1=1) WHEN MATCHED THEN UPDATE SET t.E1_SALDO=0": "not_select",
    "TRUNCATE TABLE SE1010": "not_select",
    "BEGIN DELETE FROM SE1010; END;": "multiple_statements",
    "GRANT ALL ON SE1010 TO PUBLIC": "not_select",
    "SELECT * FROM SE1010 WHERE D_E_L_E_T_ <> '*'": "select_star_forbidden",
    "SELECT S.* FROM SE1010 S WHERE S.D_E_L_E_T_ <> '*'": "select_star_forbidden",
    "SELECT DBMS_XMLGEN.GETXML('x') FROM DUAL WHERE D_E_L_E_T_=' '": "forbidden_function",
    "SELECT E1_NUM FROM SE1010 WHERE D_E_L_E_T_ <> '*' -- x": "comments_forbidden",
    "SELECT E1_NUM FROM SE1010 /* x */ WHERE D_E_L_E_T_ <> '*'": "comments_forbidden",
    "SELECT E1_NUM FROM SE1010 WHERE E1_X = 'D_E_L_E_T_'": "missing_delet_filter",
    "SELECT E1_NUM FROM SE1010 WHERE D_E_L_E_T_ <> '*' FOR UPDATE": "forbidden_sql",
    "SELECT E1_NUM INTO v FROM SE1010 WHERE D_E_L_E_T_ <> '*'": "forbidden_sql",
    "SELECT E1_NUM FROM SE1010@remote WHERE D_E_L_E_T_ <> '*'": "db_link_forbidden",
    "": "invalid_sql",
}


@pytest.mark.parametrize("sql", OK)
def test_allows_readonly_selects(sql):
    assert guard(sql).allowed, guard(sql)


@pytest.mark.parametrize("sql,reason", BAD.items())
def test_blocks_dangerous_sql(sql, reason):
    verdict = guard(sql)
    assert not verdict.allowed
    assert verdict.reason == reason


def test_semicolon_inside_literal_is_not_a_second_statement():
    assert guard("SELECT E1_NUM FROM SE1010 WHERE D_E_L_E_T_ <> '*' AND E1_HIST = 'a;b'").allowed


def test_table_allowlist():
    sql = "SELECT E1_NUM FROM SA6010 WHERE D_E_L_E_T_ <> '*'"
    assert guard(sql, allowed_tables={"SA6010"}).allowed
    v = guard(sql, allowed_tables={"SE1010"})
    assert not v.allowed and v.reason == "table_not_allowed"
