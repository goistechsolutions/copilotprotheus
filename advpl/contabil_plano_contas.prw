#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function CTBPLN()
Return

WSRESTFUL PlanoContasRest DESCRIPTION "Plano de Contas - CTT010"

    WSDATA cFilial   AS STRING
    WSDATA cCusto    AS STRING
    WSDATA cClasse   AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Lista plano de contas (centros de custo)" ;
        WSSYNTAX "/PlanoContasRest?cFilial={cFilial}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna plano de contas (centros de custo) da CTT010 paginado (Oracle ROWNUM)
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cFilial, cCusto, cClasse, nPage, nPageSize WSSERVICE PlanoContasRest
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
  cQuery += "      CTT.CTT_CUSTO, CTT.CTT_DESC01, CTT.CTT_CLASSE, "
  cQuery += "      CTT.CTT_BLOQ, CTT.CTT_UPPER "
  cQuery += "    FROM " + RetSqlName("CTT") + " CTT "
  cQuery += "    WHERE CTT.D_E_L_E_T_ = ' ' "
  cQuery += "      AND CTT.CTT_FILIAL = '" + Self:cFilial + "' "

  If !Empty(Self:cCusto)
    cQuery += "      AND CTT.CTT_CUSTO LIKE '" + Self:cCusto + "%' "
  EndIf
  If !Empty(Self:cClasse)
    cQuery += "      AND CTT.CTT_CLASSE = '" + Self:cClasse + "' "
  EndIf

  cQuery += "    ORDER BY CTT.CTT_CUSTO "
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
      oItem["custo"]     := AllTrim((cAlias)->CTT_CUSTO)
      oItem["descricao"] := AllTrim((cAlias)->CTT_DESC01)
      oItem["classe"]    := AllTrim((cAlias)->CTT_CLASSE)
      oItem["bloqueio"]  := AllTrim((cAlias)->CTT_BLOQ)
      oItem["superior"]  := AllTrim((cAlias)->CTT_UPPER)
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
