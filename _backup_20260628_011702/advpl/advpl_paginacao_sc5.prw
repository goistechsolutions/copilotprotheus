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
  Local oQry := TCGenQry(,,cQuery)
  If oQry != Nil
    Do While !oQry:EoF()
      aAdd(aRet, {"num"=>Trim(oQry:C5_NUM),"cliente"=>Trim(oQry:C5_CLIENTE),;
        "emissao"=>Trim(oQry:C5_EMISSAO),"nota"=>Trim(oQry:C5_NOTA),"bloquei"=>Trim(oQry:C5_BLOQUEI)})
      oQry:Skip()
    EndDo
    oQry:DeActivate() ; FreeObj(oQry)
  EndIf
  oRest:setContentType("application/json")
  oRest:setResponse(FWJsonSerialize({"page"=>nPage,"limit"=>nLimit,"items"=>aRet}))
Return .T.
