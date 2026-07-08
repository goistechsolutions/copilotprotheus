#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function FISCLIV()
Return

WSRESTFUL LivrosFiscaisRest DESCRIPTION "Livros Fiscais - SFB010"

    WSDATA cDtDe     AS STRING
    WSDATA cDtAte    AS STRING
    WSDATA cFilial   AS STRING
    WSDATA cNfiscal  AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Lista livros fiscais com paginacao e filtro por periodo" ;
        WSSYNTAX "/LivrosFiscaisRest?cFilial={cFilial}&cDtDe={cDtDe}&cDtAte={cDtAte}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna livros fiscais da SFB010 paginados (Oracle ROWNUM)
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFilial, cNfiscal, nPage, nPageSize WSSERVICE LivrosFiscaisRest
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
  cQuery += "      FB.FB_NFISCAL, FB.FB_SERIE, FB.FB_CLIFOR, FB.FB_LOJA, "
  cQuery += "      FB.FB_EMISSAO, FB.FB_BASEICM, FB.FB_VALICM, "
  cQuery += "      FB.FB_BASEIPI, FB.FB_VALIPI "
  cQuery += "    FROM " + RetSqlName("SFB") + " FB "
  cQuery += "    WHERE FB.D_E_L_E_T_ = ' ' "
  cQuery += "      AND FB.FB_FILIAL = '" + Self:cFilial + "' "
  cQuery += "      AND FB.FB_EMISSAO >= '" + Self:cDtDe + "' "
  cQuery += "      AND FB.FB_EMISSAO <= '" + Self:cDtAte + "' "

  If !Empty(Self:cNfiscal)
    cQuery += "      AND FB.FB_NFISCAL = '" + Self:cNfiscal + "' "
  EndIf

  cQuery += "    ORDER BY FB.FB_EMISSAO DESC, FB.FB_NFISCAL "
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
      oItem["nfiscal"]     := AllTrim((cAlias)->FB_NFISCAL)
      oItem["serie"]       := AllTrim((cAlias)->FB_SERIE)
      oItem["clifor"]      := AllTrim((cAlias)->FB_CLIFOR)
      oItem["loja"]        := AllTrim((cAlias)->FB_LOJA)
      oItem["emissao"]     := AllTrim((cAlias)->FB_EMISSAO)
      oItem["baseIcm"]     := (cAlias)->FB_BASEICM
      oItem["valorIcm"]    := (cAlias)->FB_VALICM
      oItem["baseIpi"]     := (cAlias)->FB_BASEIPI
      oItem["valorIpi"]    := (cAlias)->FB_VALIPI
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
