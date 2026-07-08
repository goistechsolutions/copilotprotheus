#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function FISCITM()
Return

WSRESTFUL ItensNfRest DESCRIPTION "Itens de Nota Fiscal - SFT010"

    WSDATA cDtDe     AS STRING
    WSDATA cDtAte    AS STRING
    WSDATA cFilial   AS STRING
    WSDATA cNfiscal  AS STRING
    WSDATA cSerie    AS STRING
    WSDATA nPage     AS INTEGER
    WSDATA nPageSize AS INTEGER

    WSMETHOD GET DESCRIPTION "Lista itens de NF com paginacao e filtro por periodo" ;
        WSSYNTAX "/ItensNfRest?cFilial={cFilial}&cDtDe={cDtDe}&cDtAte={cDtAte}"

END WSRESTFUL

/*
|--------------------------------------------------------------------------
| Metodo: GET
| Retorna itens NF da SFT010 paginados (Oracle ROWNUM)
| HIGH VOLUME TABLE — default limit 50
|--------------------------------------------------------------------------
*/
WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFilial, cNfiscal, cSerie, nPage, nPageSize WSSERVICE ItensNfRest
  Local aRet      := {}
  Local lHasNext  := .F.
  Local aArea     := GetArea()
  Local nPg       := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz     := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 100, Self:nPageSize, 50)
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
  cQuery += "      FT.FT_NFISCAL, FT.FT_SERIE, FT.FT_ITEM, FT.FT_PRODUTO, "
  cQuery += "      FT.FT_QUANT, FT.FT_PRCUNI, FT.FT_VALCONT, "
  cQuery += "      FT.FT_ALIQICM, FT.FT_VALICM, FT.FT_ALIQIPI, FT.FT_VALIPI "
  cQuery += "    FROM " + RetSqlName("SFT") + " FT "
  cQuery += "    WHERE FT.D_E_L_E_T_ = ' ' "
  cQuery += "      AND FT.FT_FILIAL = '" + Self:cFilial + "' "
  cQuery += "      AND FT.FT_EMISSAO >= '" + Self:cDtDe + "' "
  cQuery += "      AND FT.FT_EMISSAO <= '" + Self:cDtAte + "' "

  If !Empty(Self:cNfiscal)
    cQuery += "      AND FT.FT_NFISCAL = '" + Self:cNfiscal + "' "
  EndIf
  If !Empty(Self:cSerie)
    cQuery += "      AND FT.FT_SERIE = '" + Self:cSerie + "' "
  EndIf

  cQuery += "    ORDER BY FT.FT_EMISSAO DESC, FT.FT_NFISCAL, FT.FT_ITEM "
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
      oItem["nfiscal"]   := AllTrim((cAlias)->FT_NFISCAL)
      oItem["serie"]     := AllTrim((cAlias)->FT_SERIE)
      oItem["item"]      := AllTrim((cAlias)->FT_ITEM)
      oItem["produto"]   := AllTrim((cAlias)->FT_PRODUTO)
      oItem["quant"]     := (cAlias)->FT_QUANT
      oItem["prcUni"]    := (cAlias)->FT_PRCUNI
      oItem["valCont"]   := (cAlias)->FT_VALCONT
      oItem["aliqIcm"]   := (cAlias)->FT_ALIQICM
      oItem["valIcm"]    := (cAlias)->FT_VALICM
      oItem["aliqIpi"]   := (cAlias)->FT_ALIQIPI
      oItem["valIpi"]    := (cAlias)->FT_VALIPI
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
