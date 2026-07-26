#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function CTBBAL()
Return

WSRESTFUL BalanceteRest DESCRIPTION "Balancete Contabil - CT1/CTT/CT2"

    WSDATA cDtDe     AS STRING
    WSDATA cDtAte    AS STRING
    WSDATA cFilial   AS STRING
    WSDATA cConta    AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Retorna balancete contabil com paginacao e filtro" ;
        WSSYNTAX "/BalanceteRest?cFilial={cFilial}&cDtDe={cDtDe}&cDtAte={cDtAte}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna balancete contabil (CT1 + CTT + CT2) paginado (Oracle ROWNUM)
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFilial, cConta, nPage, nPageSize WSSERVICE BalanceteRest
  Local aRet      := {}
  Local lHasNext  := .F.
  Local aArea     := GetArea()
  Local nPg       := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz     := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset   := (nPg - 1) * nPgSz
  Local cQuery    := ""
  Local cAlias    := GetNextAlias()
  Local nCount    := 0
  Local oItem
  Local oResponse
  Local lRet      := .T.

  ::SetContentType("application/json")

  // --- Validacao obrigatoria de periodo ---
  If Empty(Self:cDtDe) .Or. Empty(Self:cDtAte)
    SetRestFault(400, "Parametros cDtDe e cDtAte sao obrigatorios (YYYYMMDD)")
    RestArea(aArea)
    Return .F.
  EndIf

  If Empty(Self:cFilial)
    SetRestFault(400, "Parametro cFilial eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  // --- Query paginada com ROWNUM (Oracle) ---
  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT "
  cQuery += "      CT1.CT1_CONTA, CT1.CT1_DESC01, CTT.CTT_CLASSE, "
  cQuery += "      NVL(SUM(CASE WHEN CT2.CT2_DEBITO = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS TOTAL_DEBITO, "
  cQuery += "      NVL(SUM(CASE WHEN CT2.CT2_CREDIT = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS TOTAL_CREDITO "
  cQuery += "    FROM " + RetSqlName("CT1") + " CT1 "
  cQuery += "    LEFT JOIN " + RetSqlName("CTT") + " CTT "
  cQuery += "      ON CTT.CTT_CUSTO = CT1.CT1_CONTA "
  cQuery += "      AND CTT.D_E_L_E_T_ = ' ' "
  cQuery += "      AND CTT.CTT_BLOQ <> '1' "
  cQuery += "    LEFT JOIN " + RetSqlName("CT2") + " CT2 "
  cQuery += "      ON (CT2.CT2_DEBITO = CT1.CT1_CONTA OR CT2.CT2_CREDIT = CT1.CT1_CONTA) "
  cQuery += "      AND CT2.D_E_L_E_T_ = ' ' "
  cQuery += "      AND CT2.CT2_FILIAL = '" + Self:cFilial + "' "
  cQuery += "      AND CT2.CT2_DATA >= '" + Self:cDtDe + "' "
  cQuery += "      AND CT2.CT2_DATA <= '" + Self:cDtAte + "' "
  cQuery += "    WHERE CT1.D_E_L_E_T_ = ' ' "
  cQuery += "      AND CT1.CT1_FILIAL = '" + Self:cFilial + "' "

  If !Empty(Self:cConta)
    cQuery += "      AND CT1.CT1_CONTA LIKE '" + Self:cConta + "%' "
  EndIf

  cQuery += "    GROUP BY CT1.CT1_CONTA, CT1.CT1_DESC01, CTT.CTT_CLASSE "
  cQuery += "    ORDER BY CT1.CT1_CONTA "
  cQuery += "  ) T WHERE ROWNUM <= " + cValToChar(nOffset + nPgSz + 1) + " "
  cQuery += ") WHERE RNUM > " + cValToChar(nOffset) + " "

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)

  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      nCount++
      If nCount > nPgSz
        lHasNext := .T.
        Exit
      EndIf

      oItem := JsonObject():New()
      oItem["conta"]        := AllTrim((cAlias)->CT1_CONTA)
      oItem["descricao"]    := AllTrim((cAlias)->CT1_DESC01)
      oItem["classe"]       := AllTrim((cAlias)->CTT_CLASSE)
      oItem["totalDebito"]  := (cAlias)->TOTAL_DEBITO
      oItem["totalCredito"] := (cAlias)->TOTAL_CREDITO
      oItem["saldo"]        := (cAlias)->TOTAL_DEBITO - (cAlias)->TOTAL_CREDITO
      aAdd(aRet, oItem)

      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"]    := nPg
  oResponse["limit"]   := nPgSz
  oResponse["items"]   := aRet
  oResponse["hasNext"] := lHasNext

  ::SetResponse(oResponse:ToJson())

  RestArea(aArea)
Return(lRet)
