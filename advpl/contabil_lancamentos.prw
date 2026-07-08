#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function CTBLCT()
Return

WSRESTFUL LancamentosContabeisRest DESCRIPTION "Lancamentos Contabeis - CT2010"

    WSDATA cDtDe     AS STRING
    WSDATA cDtAte    AS STRING
    WSDATA cFilial   AS STRING
    WSDATA cDebito   AS STRING
    WSDATA cCredito  AS STRING
    WSDATA cLote     AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Lista lancamentos contabeis com paginacao e filtro obrigatorio por periodo" ;
        WSSYNTAX "/LancamentosContabeisRest?cFilial={cFilial}&cDtDe={cDtDe}&cDtAte={cDtAte}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna lancamentos contabeis da CT2010 paginados (Oracle ROWNUM)
| CRITICAL TABLE — filtro de periodo obrigatorio
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFilial, cDebito, cCredito, cLote, nPage, nPageSize WSSERVICE LancamentosContabeisRest
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
  cQuery += "      CT2.CT2_DATA, CT2.CT2_DEBITO, CT2.CT2_CREDIT, "
  cQuery += "      CT2.CT2_VALOR, CT2.CT2_HIST, "
  cQuery += "      CT2.CT2_CCD, CT2.CT2_CCC, CT2.CT2_LOTE "
  cQuery += "    FROM " + RetSqlName("CT2") + " CT2 "
  cQuery += "    WHERE CT2.D_E_L_E_T_ = ' ' "
  cQuery += "      AND CT2.CT2_FILIAL = '" + Self:cFilial + "' "
  cQuery += "      AND CT2.CT2_DATA >= '" + Self:cDtDe + "' "
  cQuery += "      AND CT2.CT2_DATA <= '" + Self:cDtAte + "' "

  If !Empty(Self:cDebito)
    cQuery += "      AND CT2.CT2_DEBITO = '" + Self:cDebito + "' "
  EndIf
  If !Empty(Self:cCredito)
    cQuery += "      AND CT2.CT2_CREDIT = '" + Self:cCredito + "' "
  EndIf
  If !Empty(Self:cLote)
    cQuery += "      AND CT2.CT2_LOTE = '" + Self:cLote + "' "
  EndIf

  cQuery += "    ORDER BY CT2.CT2_DATA DESC, CT2.CT2_DEBITO, CT2.CT2_CREDIT "
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
      oItem["data"]       := AllTrim((cAlias)->CT2_DATA)
      oItem["debito"]     := AllTrim((cAlias)->CT2_DEBITO)
      oItem["credito"]    := AllTrim((cAlias)->CT2_CREDIT)
      oItem["valor"]      := (cAlias)->CT2_VALOR
      oItem["historico"]  := AllTrim((cAlias)->CT2_HIST)
      oItem["ccDebito"]   := AllTrim((cAlias)->CT2_CCD)
      oItem["ccCredito"]  := AllTrim((cAlias)->CT2_CCC)
      oItem["lote"]       := AllTrim((cAlias)->CT2_LOTE)
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
