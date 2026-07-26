#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function FISCNFE()
Return

WSRESTFUL NfsEmitidasRest DESCRIPTION "Notas Fiscais Emitidas - SF2/SD2"

    WSDATA cDtDe     AS STRING
    WSDATA cDtAte    AS STRING
    WSDATA cFilial   AS STRING
    WSDATA cDoc      AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Lista NFs emitidas com paginacao e filtro por periodo" ;
        WSSYNTAX "/NfsEmitidasRest?cFilial={cFilial}&cDtDe={cDtDe}&cDtAte={cDtAte}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna NFs emitidas da SF2 paginadas (Oracle ROWNUM)
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFilial, cDoc, nPage, nPageSize WSSERVICE NfsEmitidasRest
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
  cQuery += "      F2.F2_DOC, F2.F2_SERIE, F2.F2_CLIENTE, F2.F2_LOJA, "
  cQuery += "      F2.F2_EMISSAO, F2.F2_VALBRUT, F2.F2_VALFIS, F2.F2_CHVNFE "
  cQuery += "    FROM " + RetSqlName("SF2") + " F2 "
  cQuery += "    WHERE F2.D_E_L_E_T_ = ' ' "
  cQuery += "      AND F2.F2_FILIAL = '" + Self:cFilial + "' "
  cQuery += "      AND F2.F2_EMISSAO >= '" + Self:cDtDe + "' "
  cQuery += "      AND F2.F2_EMISSAO <= '" + Self:cDtAte + "' "

  If !Empty(Self:cDoc)
    cQuery += "      AND F2.F2_DOC = '" + Self:cDoc + "' "
  EndIf

  cQuery += "    ORDER BY F2.F2_EMISSAO DESC, F2.F2_DOC "
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
      oItem["documento"]   := AllTrim((cAlias)->F2_DOC)
      oItem["serie"]       := AllTrim((cAlias)->F2_SERIE)
      oItem["cliente"]     := AllTrim((cAlias)->F2_CLIENTE)
      oItem["loja"]        := AllTrim((cAlias)->F2_LOJA)
      oItem["emissao"]     := AllTrim((cAlias)->F2_EMISSAO)
      oItem["valorBruto"]  := (cAlias)->F2_VALBRUT
      oItem["valorFiscal"] := (cAlias)->F2_VALFIS
      oItem["chaveNfe"]    := AllTrim((cAlias)->F2_CHVNFE)
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
