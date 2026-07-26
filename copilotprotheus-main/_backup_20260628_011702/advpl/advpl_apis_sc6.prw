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
  Local oQry := TCGenQry(,,cQuery)
  If oQry != Nil
    Do While !oQry:EoF()
      aAdd(aRet, {"num"=>Trim(oQry:C6_NUM),"item"=>Trim(oQry:C6_ITEM),;
        "produto"=>Trim(oQry:C6_PRODUTO),"descri"=>Trim(oQry:C6_DESCRI),;
        "qtdVen"=>oQry:C6_QTDVEN,"qtdEnt"=>oQry:C6_QTDENT,"prcVen"=>oQry:C6_PRCVEN})
      oQry:Skip()
    EndDo
    oQry:DeActivate() ; FreeObj(oQry)
  EndIf
  oRest:setContentType("application/json")
  oRest:setResponse(FWJsonSerialize({"page"=>nPage,"limit"=>nLimit,"items"=>aRet}))
Return .T.
