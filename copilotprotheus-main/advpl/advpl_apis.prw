#INCLUDE "TOTVS.CH"
#INCLUDE "RESTFUL.CH"
// ??? STATUS DO PEDIDO ???????????????????????????????????????
WSRESTFUL PedidoStatus DESCRIPTION "Status do pedido de venda"
  WSDATA pedido AS STRING
  WSMETHOD GET DESCRIPTION "Retorna status do pedido"
END WSRESTFUL
WSMETHOD GET WSSERVICE PedidoStatus
  LOCAL cPedido
  LOCAL oResp
  cPedido := Self:pedido
  oResp   := JsonObject():New()
  DbSelectArea("SC5")
  DbSetOrder(1)
  IF DbSeek(xFilial("SC5") + cPedido)
    oResp["pedido"]    := AllTrim(SC5->C5_NUM)
    oResp["cliente"]   := AllTrim(SC5->C5_CLI)
    oResp["emissao"]   := DToC(SC5->C5_EMISSAO)
    oResp["nota"]      := AllTrim(SC5->C5_NOTA)
    oResp["bloqueado"] := AllTrim(SC5->C5_BLOQUEI)
    oResp["status"]    := If(Empty(SC5->C5_NOTA), "Nao Faturado", "Faturado")
    Self:SetResponse(oResp:ToJson())
  ELSE
    Self:SetStatus(404)
    Self:SetResponse('{"error":"Pedido nao encontrado"}')
  ENDIF
Return .T.
// ??? TITULOS A RECEBER (com paginacao) ??????????????????????
WSRESTFUL TitulosRest DESCRIPTION "Titulos a receber"
  WSDATA cliente  AS STRING
  WSDATA vencidos AS STRING
  WSDATA page     AS STRING
  WSDATA pageSize AS STRING
  WSMETHOD GET DESCRIPTION "Retorna titulos do cliente"
END WSRESTFUL
WSMETHOD GET WSSERVICE TitulosRest
  LOCAL cCliente
  LOCAL lVencidos
  LOCAL cQuery
  LOCAL cCountQry
  LOCAL oArr
  LOCAL oResp
  LOCAL nPage
  LOCAL nPageSize
  LOCAL nOffset
  LOCAL nTotal
  LOCAL oTit
  cCliente  := Self:cliente
  lVencidos := (Self:vencidos == "S")
  cQuery    := ""
  cCountQry := ""
  oArr      := JsonArray():New()
  oResp     := JsonObject():New()
  nPage     := 1
  nPageSize := 50
  nOffset   := 0
  nTotal    := 0
  // Parse pagination parameters
  IF !Empty(Self:page) .AND. Val(Self:page) > 0
    nPage := Val(Self:page)
  ENDIF
  IF !Empty(Self:pageSize) .AND. Val(Self:pageSize) > 0
    nPageSize := Val(Self:pageSize)
  ENDIF
  nOffset := (nPage - 1) * nPageSize
  // Count query for total records
  cCountQry := "SELECT COUNT(*) AS TOTAL "
  cCountQry += "FROM " + RetSqlName("SE1") + " "
  cCountQry += "WHERE D_E_L_E_T_='' AND E1_FILIAL='" + xFilial("SE1") + "' "
  cCountQry += "AND E1_CLIENTE='" + cCliente + "' "
  IF lVencidos
    cCountQry += "AND E1_VENCTO < '" + DToS(Date()) + "' "
  ENDIF
  DbUseArea(.T., "TOPCONN", TCGenQry(,,cCountQry), "QRY_CNT", .F., .T.)
  nTotal := QRY_CNT->TOTAL
  QRY_CNT->(DbCloseArea())
  // Data query with pagination
  cQuery := "SELECT E1_NUM, E1_TIPO, E1_VENCTO, E1_VALOR, E1_SALDO "
  cQuery += "FROM " + RetSqlName("SE1") + " "
  cQuery += "WHERE D_E_L_E_T_='' AND E1_FILIAL='" + xFilial("SE1") + "' "
  cQuery += "AND E1_CLIENTE='" + cCliente + "' "
  IF lVencidos
    cQuery += "AND E1_VENCTO < '" + DToS(Date()) + "' "
  ENDIF
  cQuery += "ORDER BY E1_VENCTO, E1_NUM "
  cQuery += "OFFSET " + cValToChar(nOffset) + " ROWS "
  cQuery += "FETCH NEXT " + cValToChar(nPageSize) + " ROWS ONLY"
  DbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), "QRY_SE1", .F., .T.)
  While !QRY_SE1->(EOF())
    oTit := JsonObject():New()
    oTit["num"]     := AllTrim(QRY_SE1->E1_NUM)
    oTit["tipo"]    := AllTrim(QRY_SE1->E1_TIPO)
    oTit["vencto"]  := AllTrim(QRY_SE1->E1_VENCTO)
    oTit["valor"]   := QRY_SE1->E1_VALOR
    oTit["saldo"]   := QRY_SE1->E1_SALDO
    oArr:Add(oTit)
    QRY_SE1->(DbSkip())
  End
  QRY_SE1->(DbCloseArea())
  // Build paginated response
  oResp["page"]      := nPage
  oResp["pageSize"]  := nPageSize
  oResp["total"]     := nTotal
  oResp["totalPages"]:= Ceiling(nTotal / nPageSize)
  oResp["items"]     := oArr
  Self:SetResponse(oResp:ToJson())
Return .T.
// ??? SALDO DE ESTOQUE ???????????????????????????????????????
WSRESTFUL SaldoRest DESCRIPTION "Saldo de estoque"
  WSDATA produto AS STRING
  WSDATA filial  AS STRING
  WSMETHOD GET DESCRIPTION "Retorna saldo do produto"
END WSRESTFUL
WSMETHOD GET WSSERVICE SaldoRest
  LOCAL cProduto
  LOCAL cFilial
  LOCAL oResp
  cProduto := Self:produto
  cFilial  := If(Empty(Self:filial), xFilial("SB2"), Self:filial)
  oResp    := JsonObject():New()
  DbSelectArea("SB2")
  DbSetOrder(1)
  IF DbSeek(cFilial + cProduto + "  ")
    oResp["produto"]  := AllTrim(SB2->B2_COD)
    oResp["filial"]   := AllTrim(SB2->B2_FILIAL)
    oResp["saldo"]    := SB2->B2_QATU
    oResp["minimo"]   := SB2->B2_QMIN
    oResp["maximo"]   := SB2->B2_QMAX
    oResp["ruptura"]  := If(SB2->B2_QATU <= 0, "S", "N")
    oResp["abaixoMin"]:= If(SB2->B2_QATU < SB2->B2_QMIN, "S", "N")
    Self:SetResponse(oResp:ToJson())
  ELSE
    Self:SetStatus(404)
    Self:SetResponse('{"error":"Produto nao encontrado"}')
  ENDIF
Return .T.
// ??? PEDIDOS DE COMPRA (com paginacao) ??????????????????????
WSRESTFUL ComprasRest DESCRIPTION "Pedidos de compra"
  WSDATA fornecedor AS STRING
  WSDATA filial     AS STRING
  WSDATA page       AS STRING
  WSDATA pageSize   AS STRING
  WSMETHOD GET DESCRIPTION "Retorna pedidos de compra"
END WSRESTFUL
WSMETHOD GET WSSERVICE ComprasRest
  LOCAL cForn
  LOCAL cQuery
  LOCAL cCountQry
  LOCAL oArr
  LOCAL oResp
  LOCAL nPage
  LOCAL nPageSize
  LOCAL nOffset
  LOCAL nTotal
  LOCAL oPC
  cForn     := Self:fornecedor
  cQuery    := ""
  cCountQry := ""
  oArr      := JsonArray():New()
  oResp     := JsonObject():New()
  nPage     := 1
  nPageSize := 50
  nOffset   := 0
  nTotal    := 0
  // Parse pagination parameters
  IF !Empty(Self:page) .AND. Val(Self:page) > 0
    nPage := Val(Self:page)
  ENDIF
  IF !Empty(Self:pageSize) .AND. Val(Self:pageSize) > 0
    nPageSize := Val(Self:pageSize)
  ENDIF
  nOffset := (nPage - 1) * nPageSize
  // Count query for total records
  cCountQry := "SELECT COUNT(*) AS TOTAL "
  cCountQry += "FROM " + RetSqlName("SC7") + " "
  cCountQry += "WHERE D_E_L_E_T_='' AND C7_FILIAL='" + xFilial("SC7") + "' "
  cCountQry += "AND C7_RESIDUO <> '0' "
  IF !Empty(cForn)
    cCountQry += "AND C7_FORNECE='" + cForn + "' "
  ENDIF
  DbUseArea(.T., "TOPCONN", TCGenQry(,,cCountQry), "QRY_CNT", .F., .T.)
  nTotal := QRY_CNT->TOTAL
  QRY_CNT->(DbCloseArea())
  // Data query with pagination
  cQuery := "SELECT C7_NUM, C7_FORNECE, C7_PRODUTO, C7_QUANT, C7_DATPRF, C7_RESIDUO "
  cQuery += "FROM " + RetSqlName("SC7") + " "
  cQuery += "WHERE D_E_L_E_T_='' AND C7_FILIAL='" + xFilial("SC7") + "' "
  cQuery += "AND C7_RESIDUO <> '0' "
  IF !Empty(cForn)
    cQuery += "AND C7_FORNECE='" + cForn + "' "
  ENDIF
  cQuery += "ORDER BY C7_NUM, C7_PRODUTO "
  cQuery += "OFFSET " + cValToChar(nOffset) + " ROWS "
  cQuery += "FETCH NEXT " + cValToChar(nPageSize) + " ROWS ONLY"
  DbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), "QRY_SC7", .F., .T.)
  While !QRY_SC7->(EOF())
    oPC := JsonObject():New()
    oPC["num"]      := AllTrim(QRY_SC7->C7_NUM)
    oPC["fornece"]  := AllTrim(QRY_SC7->C7_FORNECE)
    oPC["produto"]  := AllTrim(QRY_SC7->C7_PRODUTO)
    oPC["quant"]    := QRY_SC7->C7_QUANT
    oPC["datprf"]   := AllTrim(QRY_SC7->C7_DATPRF)
    oPC["atrasado"] := If(QRY_SC7->C7_DATPRF < DToS(Date()), "S", "N")
    oArr:Add(oPC)
    QRY_SC7->(DbSkip())
  End
  QRY_SC7->(DbCloseArea())
  // Build paginated response
  oResp["page"]      := nPage
  oResp["pageSize"]  := nPageSize
  oResp["total"]     := nTotal
  oResp["totalPages"]:= Ceiling(nTotal / nPageSize)
  oResp["items"]     := oArr
  Self:SetResponse(oResp:ToJson())
Return .T.
// ??? ITENS DO PEDIDO DE VENDA (SC6) ????????????????????????
WSRESTFUL ItensPedidoRest DESCRIPTION "Itens do pedido de venda"
  WSDATA pedido AS STRING
  WSMETHOD GET DESCRIPTION "Retorna itens do pedido"
END WSRESTFUL
WSMETHOD GET WSSERVICE ItensPedidoRest
  LOCAL cPedido
  LOCAL cQuery
  LOCAL oArr
  LOCAL oItem
  cPedido := Self:pedido
  cQuery  := ""
  oArr    := JsonArray():New()
  IF Empty(cPedido)
    Self:SetStatus(400)
    Self:SetResponse('{"error":"Parametro pedido obrigatorio"}')
    Return .T.
  ENDIF
  cQuery := "SELECT C6_NUM, C6_ITEM, C6_PRODUTO, C6_DESCRI, "
  cQuery += "C6_QTDVEN, C6_PRCVEN, C6_VALOR, C6_BLQ, C6_ENTREG "
  cQuery += "FROM " + RetSqlName("SC6") + " "
  cQuery += "WHERE D_E_L_E_T_='' AND C6_FILIAL='" + xFilial("SC6") + "' "
  cQuery += "AND C6_NUM='" + cPedido + "' "
  cQuery += "ORDER BY C6_NUM, C6_ITEM"
  DbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), "QRY_SC6", .F., .T.)
  While !QRY_SC6->(EOF())
    oItem := JsonObject():New()
    oItem["num"]     := AllTrim(QRY_SC6->C6_NUM)
    oItem["item"]    := AllTrim(QRY_SC6->C6_ITEM)
    oItem["produto"] := AllTrim(QRY_SC6->C6_PRODUTO)
    oItem["descri"]  := AllTrim(QRY_SC6->C6_DESCRI)
    oItem["qtdven"]  := QRY_SC6->C6_QTDVEN
    oItem["prcven"]  := QRY_SC6->C6_PRCVEN
    oItem["valor"]   := QRY_SC6->C6_VALOR
    oItem["blq"]     := AllTrim(QRY_SC6->C6_BLQ)
    oItem["entreg"]  := AllTrim(QRY_SC6->C6_ENTREG)
    oArr:Add(oItem)
    QRY_SC6->(DbSkip())
  End
  QRY_SC6->(DbCloseArea())
  IF oArr:Length() == 0
    Self:SetStatus(404)
    Self:SetResponse('{"error":"Nenhum item encontrado para o pedido"}')
    Return .T.
  ENDIF
  Self:SetResponse(oArr:ToJson())
Return .T.
// ??? CLIENTE (SA1) ??????????????????????????????????????????
WSRESTFUL ClienteRest DESCRIPTION "Cadastro de Cliente"
  WSDATA codigo AS STRING
  WSMETHOD GET DESCRIPTION "Retorna dados do cliente"
END WSRESTFUL
WSMETHOD GET WSSERVICE ClienteRest
  LOCAL cCod
  LOCAL oResp
  cCod  := Self:codigo
  oResp := JsonObject():New()
  DbSelectArea("SA1")
  DbSetOrder(1)
  IF DbSeek(xFilial("SA1") + cCod)
    oResp["codigo"] := AllTrim(SA1->A1_COD)
    oResp["loja"]   := AllTrim(SA1->A1_LOJA)
    oResp["nome"]   := AllTrim(SA1->A1_NOME)
    oResp["cgc"]    := AllTrim(SA1->A1_CGC)
    oResp["risco"]  := AllTrim(SA1->A1_RISCO)
    oResp["limcred"]:= SA1->A1_LC
    oResp["vencred"]:= DToC(SA1->A1_VENCLC)
    oResp["bloqueio"]:= AllTrim(SA1->A1_MSBLQL)
    Self:SetResponse(oResp:ToJson())
  ELSE
    Self:SetStatus(404)
    Self:SetResponse('{"error":"Cliente nao encontrado"}')
  ENDIF
Return .T.
// ??? PRODUTO (SB1) ??????????????????????????????????????????
WSRESTFUL ProdutoRest DESCRIPTION "Cadastro de Produto"
  WSDATA codigo AS STRING
  WSMETHOD GET DESCRIPTION "Retorna dados do produto"
END WSRESTFUL
WSMETHOD GET WSSERVICE ProdutoRest
  LOCAL cCod
  LOCAL oResp
  cCod  := Self:codigo
  oResp := JsonObject():New()
  DbSelectArea("SB1")
  DbSetOrder(1)
  IF DbSeek(xFilial("SB1") + cCod)
    oResp["codigo"] := AllTrim(SB1->B1_COD)
    oResp["descri"] := AllTrim(SB1->B1_DESC)
    oResp["tipo"]   := AllTrim(SB1->B1_TIPO)
    oResp["um"]     := AllTrim(SB1->B1_UM)
    oResp["grupo"]  := AllTrim(SB1->B1_GRUPO)
    oResp["bloqueio"]:= AllTrim(SB1->B1_MSBLQL)
    Self:SetResponse(oResp:ToJson())
  ELSE
    Self:SetStatus(404)
    Self:SetResponse('{"error":"Produto nao encontrado"}')
  ENDIF
Return .T.
