#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function FISCTES()
Return

WSRESTFUL TesRest DESCRIPTION "Tipos de Entrada e Saida - SF4010"

    WSDATA cFilial   AS STRING
    WSDATA cCodigo   AS STRING
    WSDATA cTipo     AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Lista TES (Tipos de Entrada/Saida)" ;
        WSSYNTAX "/TesRest?cFilial={cFilial}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna TES da SF4010 paginadas (Oracle ROWNUM)
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cFilial, cCodigo, cTipo, nPage, nPageSize WSSERVICE TesRest
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

  If Empty(Self:cFilial)
    SetRestFault(400, "Parametro cFilial eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  // --- Query paginada com ROWNUM (Oracle) ---
  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT "
  cQuery += "      F4.F4_CODIGO, F4.F4_TEXTO, F4.F4_TIPO, F4.F4_CF, "
  cQuery += "      F4.F4_ICM, F4.F4_IPI, F4.F4_ISS, "
  cQuery += "      F4.F4_CREDICM, F4.F4_CREDIPI "
  cQuery += "    FROM " + RetSqlName("SF4") + " F4 "
  cQuery += "    WHERE F4.D_E_L_E_T_ = ' ' "
  cQuery += "      AND F4.F4_FILIAL = '" + Self:cFilial + "' "

  If !Empty(Self:cCodigo)
    cQuery += "      AND F4.F4_CODIGO = '" + Self:cCodigo + "' "
  EndIf
  If !Empty(Self:cTipo)
    cQuery += "      AND F4.F4_TIPO = '" + Self:cTipo + "' "
  EndIf

  cQuery += "    ORDER BY F4.F4_CODIGO "
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
      oItem["codigo"]   := AllTrim((cAlias)->F4_CODIGO)
      oItem["texto"]    := AllTrim((cAlias)->F4_TEXTO)
      oItem["tipo"]     := AllTrim((cAlias)->F4_TIPO)
      oItem["cfop"]     := AllTrim((cAlias)->F4_CF)
      oItem["icm"]      := AllTrim((cAlias)->F4_ICM)
      oItem["ipi"]      := AllTrim((cAlias)->F4_IPI)
      oItem["iss"]      := AllTrim((cAlias)->F4_ISS)
      oItem["credIcm"]  := AllTrim((cAlias)->F4_CREDICM)
      oItem["credIpi"]  := AllTrim((cAlias)->F4_CREDIPI)
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
