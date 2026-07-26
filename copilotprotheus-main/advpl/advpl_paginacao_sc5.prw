// advpl_paginacao_sc5.prw  -- SC5 com paginacao (aplicar tambem em SE1, SB2, SC7)
WSMETHOD GET WSRECEIVE cPedido, cFilial, nPage, nLimit WSSERVICE PedidosRest
  Local aRet   := {}
  Local nPage  := If(ValType(nPage)=="N".And.nPage>0,nPage,1)
  Local nLimit := If(ValType(nLimit)=="N".And.nLimit>0.And.nLimit<=200,nLimit,100)
  Local cQuery := "SELECT TOP "+cValToChar(nLimit)+" "
  cQuery += "C5_NUM, C5_CLIENTE, C5_EMISSAO, C5_NOTA, C5_BLOQUEI "
  cQuery += "FROM "+RetSqlName("SC5")+" SC5 "
  cQuery += "WHERE SC5.D_E_L_E_T_ = '' "
  If !Empty(cFilial)  ; cQuery += "AND C5_FILIAL = '"+xFilial("SC5")+"' " ; EndIf
  If !Empty(cPedido)  ; cQuery += "AND C5_NUM = '"+cPedido+"' " ; EndIf
  cQuery += "ORDER BY C5_EMISSAO DESC "
  Local cAlias := GetNextAlias()
  Local oItem
  Local oResponse

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)

  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      oItem := JsonObject():New()
      oItem["num"]     := Trim((cAlias)->C5_NUM)
      oItem["cliente"] := Trim((cAlias)->C5_CLIENTE)
      oItem["emissao"] := Trim((cAlias)->C5_EMISSAO)
      oItem["nota"]    := Trim((cAlias)->C5_NOTA)
      oItem["bloquei"] := Trim((cAlias)->C5_BLOQUEI)
      aAdd(aRet, oItem)

      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf
  oRest:setContentType("application/json")
  oResponse := JsonObject():New()
  oResponse["page"]  := nPage
  oResponse["limit"] := nLimit
  oResponse["items"] := aRet
  oRest:setResponse(FWJsonSerialize(oResponse))
Return .T.
