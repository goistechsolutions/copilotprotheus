// advpl_apis_sc6.prw  -- Endpoint REST SC6 com paginacao
WSRESTFUL ItensPedidoRest DESCRIPTION "Leitura de itens de pedido SC6"
  WSMETHOD GET DESCRIPTION "SC6 por pedido/filial com paginacao"
End WSRESTFUL

WSMETHOD GET WSRECEIVE cPedido, cFilial, nPage, nLimit WSSERVICE ItensPedidoRest
  Local aRet   := {}
  Local nPage  := If(ValType(nPage)=="N".And.nPage>0,nPage,1)
  Local nLimit := If(ValType(nLimit)=="N".And.nLimit>0.And.nLimit<=200,nLimit,100)
  Local cQuery := "SELECT TOP "+cValToChar(nLimit)+" "
  cQuery += "C6_NUM, C6_ITEM, C6_PRODUTO, C6_DESCRI, C6_QTDVEN, C6_QTDENT, C6_PRCVEN "
  cQuery += "FROM "+RetSqlName("SC6")+" SC6 "
  cQuery += "WHERE SC6.D_E_L_E_T_ = '' "
  If !Empty(cPedido) ; cQuery += "AND C6_NUM = '"+cPedido+"' " ; EndIf
  If !Empty(cFilial)  ; cQuery += "AND C6_FILIAL = '"+xFilial("SC6")+"' " ; EndIf
  cQuery += "ORDER BY C6_NUM, C6_ITEM "
  Local cAlias := GetNextAlias()
  Local oItem
  Local oResponse

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)

  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      oItem := JsonObject():New()
      oItem["num"]     := Trim((cAlias)->C6_NUM)
      oItem["item"]    := Trim((cAlias)->C6_ITEM)
      oItem["produto"] := Trim((cAlias)->C6_PRODUTO)
      oItem["descri"]  := Trim((cAlias)->C6_DESCRI)
      oItem["qtdVen"]  := (cAlias)->C6_QTDVEN
      oItem["qtdEnt"]  := (cAlias)->C6_QTDENT
      oItem["prcVen"]  := (cAlias)->C6_PRCVEN
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
