//----------------------------------------------------------
// COPILOT_PROTHEUS_APIS.PRW
// Arquivo unico com todas as APIs REST do Copilot Protheus
// Banco ORACLE — usar ROWNUM, NUNCA SELECT TOP
// Sprint 1: Comercial/Financeiro/Cadastros
// Sprint 2: Fiscal
// Sprint 3: Contabil
// Sprint 4: Query Generica
//----------------------------------------------------------
#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'


//==========================================================
//  SPRINT 1 — COMERCIAL / FINANCEIRO / CADASTROS
//==========================================================

// =========================================================
// 1. STATUS DO PEDIDO (SC5) — busca unitaria
// GET /PedidoStatus?pedido=000123
// =========================================================
WSRESTFUL PedidoStatus DESCRIPTION "Status do pedido de venda"
  WSDATA pedido AS STRING
  WSMETHOD GET DESCRIPTION "Retorna status do pedido" ;
      WSSYNTAX "/PedidoStatus?pedido={pedido}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE pedido WSSERVICE PedidoStatus
  Local cPedido := Self:pedido
  Local oResp   := JsonObject():New()
  Local aArea   := GetArea()
  Local lRet    := .T.

  ::SetContentType("application/json")

  DbSelectArea("SC5")
  DbSetOrder(1)

  If DbSeek(xFilial("SC5") + cPedido)
    oResp["pedido"]    := AllTrim(SC5->C5_NUM)
    oResp["cliente"]   := AllTrim(SC5->C5_CLIENTE)
    oResp["emissao"]   := AllTrim(SC5->C5_EMISSAO)
    oResp["nota"]      := AllTrim(SC5->C5_NOTA)
    oResp["bloqueado"] := AllTrim(SC5->C5_BLOQUEI)
    oResp["status"]    := If(Empty(SC5->C5_NOTA), "Nao Faturado", "Faturado")
    ::SetResponse(oResp:ToJson())
  Else
    SetRestFault(404, "Pedido nao encontrado")
    lRet := .F.
  EndIf

  RestArea(aArea)
Return(lRet)

// =========================================================
// 2. TITULOS A RECEBER (SE1) — com paginacao Oracle
// GET /TitulosRest?cliente=000001&vencidos=S&page=1&pageSize=50
// =========================================================
WSRESTFUL TitulosRest DESCRIPTION "Titulos a receber"
  WSDATA cliente  AS STRING
  WSDATA vencidos AS STRING
  WSDATA page     AS INTEGER
  WSDATA pageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Retorna titulos do cliente" ;
      WSSYNTAX "/TitulosRest?cliente={cliente}&vencidos={vencidos}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cliente, vencidos, page, pageSize WSSERVICE TitulosRest
  Local cCliente  := Self:cliente
  Local lVencidos := (Self:vencidos == "S")
  Local cQuery    := ""
  Local cAlias    := GetNextAlias()
  Local oResp     := JsonObject():New()
  Local aArea     := GetArea()
  Local nPage     := IIf(Self:page > 0, Self:page, 1)
  Local nPageSize := IIf(Self:pageSize > 0 .And. Self:pageSize <= 200, Self:pageSize, 50)
  Local nOffset   := (nPage - 1) * nPageSize
  Local aItems    := {}
  Local nCount    := 0
  Local lHasNext  := .F.
  Local oTit
  Local lRet      := .T.

  ::SetContentType("application/json")

  If Empty(cCliente)
    SetRestFault(400, "Parametro cliente eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT E1_NUM, E1_TIPO, E1_VENCTO, E1_VALOR, E1_SALDO "
  cQuery += "    FROM " + RetSqlName("SE1") + " "
  cQuery += "    WHERE D_E_L_E_T_ = ' ' AND E1_FILIAL = '" + xFilial("SE1") + "' "
  cQuery += "      AND E1_CLIENTE = '" + cCliente + "' "

  If lVencidos
    cQuery += "      AND E1_VENCTO < '" + DToS(Date()) + "' "
  EndIf

  cQuery += "    ORDER BY E1_VENCTO, E1_NUM "
  cQuery += "  ) T WHERE ROWNUM <= " + cValToChar(nOffset + nPageSize + 1) + " "
  cQuery += ") WHERE RNUM > " + cValToChar(nOffset) + " "

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)

  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      nCount++
      If nCount > nPageSize
        lHasNext := .T.
        Exit
      EndIf
      oTit := JsonObject():New()
      oTit["num"]    := AllTrim((cAlias)->E1_NUM)
      oTit["tipo"]   := AllTrim((cAlias)->E1_TIPO)
      oTit["vencto"] := AllTrim((cAlias)->E1_VENCTO)
      oTit["valor"]  := (cAlias)->E1_VALOR
      oTit["saldo"]  := (cAlias)->E1_SALDO
      aAdd(aItems, oTit)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResp["page"]    := nPage
  oResp["limit"]   := nPageSize
  oResp["items"]   := aItems
  oResp["hasNext"] := lHasNext

  ::SetResponse(oResp:ToJson())

  RestArea(aArea)
Return(lRet)

// =========================================================
// 3. SALDO DE ESTOQUE (SB2) — busca unitaria
// GET /SaldoRest?produto=000001&filial=01
// =========================================================
WSRESTFUL SaldoRest DESCRIPTION "Saldo de estoque"
  WSDATA produto AS STRING
  WSDATA filial  AS STRING
  WSMETHOD GET DESCRIPTION "Retorna saldo do produto" ;
      WSSYNTAX "/SaldoRest?produto={produto}&filial={filial}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE produto, filial WSSERVICE SaldoRest
  Local cProduto := Self:produto
  Local cFil     := IIf(Empty(Self:filial), xFilial("SB2"), Self:filial)
  Local oResp    := JsonObject():New()
  Local aArea    := GetArea()
  Local lRet     := .T.

  ::SetContentType("application/json")

  DbSelectArea("SB2")
  DbSetOrder(1)

  If DbSeek(cFil + cProduto + "  ")
    oResp["produto"]   := AllTrim(SB2->B2_COD)
    oResp["filial"]    := AllTrim(SB2->B2_FILIAL)
    oResp["saldo"]     := SB2->B2_QATU
    oResp["minimo"]    := SB2->B2_QMIN
    oResp["maximo"]    := SB2->B2_QMAX
    oResp["ruptura"]   := IIf(SB2->B2_QATU <= 0, "S", "N")
    oResp["abaixoMin"] := IIf(SB2->B2_QATU < SB2->B2_QMIN, "S", "N")
    ::SetResponse(oResp:ToJson())
  Else
    SetRestFault(404, "Produto nao encontrado")
    lRet := .F.
  EndIf

  RestArea(aArea)
Return(lRet)

// =========================================================
// 4. PEDIDOS DE COMPRA (SC7) — com paginacao Oracle
// GET /ComprasRest?fornecedor=000001&page=1&pageSize=50
// =========================================================
WSRESTFUL ComprasRest DESCRIPTION "Pedidos de compra"
  WSDATA fornecedor AS STRING
  WSDATA filial     AS STRING
  WSDATA page       AS INTEGER
  WSDATA pageSize   AS INTEGER
  WSMETHOD GET DESCRIPTION "Retorna pedidos de compra" ;
      WSSYNTAX "/ComprasRest?fornecedor={fornecedor}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE fornecedor, filial, page, pageSize WSSERVICE ComprasRest
  Local cForn     := Self:fornecedor
  Local cQuery    := ""
  Local cAlias    := GetNextAlias()
  Local oResp     := JsonObject():New()
  Local aArea     := GetArea()
  Local nPage     := IIf(Self:page > 0, Self:page, 1)
  Local nPageSize := IIf(Self:pageSize > 0 .And. Self:pageSize <= 200, Self:pageSize, 50)
  Local nOffset   := (nPage - 1) * nPageSize
  Local aItems    := {}
  Local nCount    := 0
  Local lHasNext  := .F.
  Local oPC
  Local lRet      := .T.

  ::SetContentType("application/json")

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT C7_NUM, C7_FORNECE, C7_PRODUTO, C7_QUANT, C7_DATPRF, C7_RESIDUO "
  cQuery += "    FROM " + RetSqlName("SC7") + " "
  cQuery += "    WHERE D_E_L_E_T_ = ' ' AND C7_FILIAL = '" + xFilial("SC7") + "' "
  cQuery += "      AND C7_RESIDUO <> '0' "

  If !Empty(cForn)
    cQuery += "      AND C7_FORNECE = '" + cForn + "' "
  EndIf

  cQuery += "    ORDER BY C7_NUM, C7_PRODUTO "
  cQuery += "  ) T WHERE ROWNUM <= " + cValToChar(nOffset + nPageSize + 1) + " "
  cQuery += ") WHERE RNUM > " + cValToChar(nOffset) + " "

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)

  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      nCount++
      If nCount > nPageSize
        lHasNext := .T.
        Exit
      EndIf
      oPC := JsonObject():New()
      oPC["num"]      := AllTrim((cAlias)->C7_NUM)
      oPC["fornece"]  := AllTrim((cAlias)->C7_FORNECE)
      oPC["produto"]  := AllTrim((cAlias)->C7_PRODUTO)
      oPC["quant"]    := (cAlias)->C7_QUANT
      oPC["datprf"]   := AllTrim((cAlias)->C7_DATPRF)
      oPC["atrasado"] := IIf((cAlias)->C7_DATPRF < DToS(Date()), "S", "N")
      aAdd(aItems, oPC)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResp["page"]    := nPage
  oResp["limit"]   := nPageSize
  oResp["items"]   := aItems
  oResp["hasNext"] := lHasNext

  ::SetResponse(oResp:ToJson())

  RestArea(aArea)
Return(lRet)

// =========================================================
// 5. ITENS DO PEDIDO DE VENDA (SC6) — paginacao Oracle
// GET /ItensPedidoRest?pedido=000123&page=1&pageSize=50
// =========================================================
WSRESTFUL ItensPedidoRest DESCRIPTION "Itens do pedido de venda"
  WSDATA pedido   AS STRING
  WSDATA page     AS INTEGER
  WSDATA pageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Retorna itens do pedido" ;
      WSSYNTAX "/ItensPedidoRest?pedido={pedido}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE pedido, page, pageSize WSSERVICE ItensPedidoRest
  Local cPedido  := Self:pedido
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local aArea    := GetArea()
  Local nPage    := IIf(Self:page > 0, Self:page, 1)
  Local nPageSz  := IIf(Self:pageSize > 0 .And. Self:pageSize <= 200, Self:pageSize, 100)
  Local nOffset  := (nPage - 1) * nPageSz
  Local aItems   := {}
  Local nCount   := 0
  Local lHasNext := .F.
  Local oItem
  Local oResp
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(cPedido)
    SetRestFault(400, "Parametro pedido eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT C6_NUM, C6_ITEM, C6_PRODUTO, C6_DESCRI, "
  cQuery += "      C6_QTDVEN, C6_QTDENT, C6_PRCVEN, C6_VALOR, C6_BLQ "
  cQuery += "    FROM " + RetSqlName("SC6") + " "
  cQuery += "    WHERE D_E_L_E_T_ = ' ' AND C6_FILIAL = '" + xFilial("SC6") + "' "
  cQuery += "      AND C6_NUM = '" + cPedido + "' "
  cQuery += "    ORDER BY C6_NUM, C6_ITEM "
  cQuery += "  ) T WHERE ROWNUM <= " + cValToChar(nOffset + nPageSz + 1) + " "
  cQuery += ") WHERE RNUM > " + cValToChar(nOffset) + " "

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)

  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      nCount++
      If nCount > nPageSz
        lHasNext := .T.
        Exit
      EndIf
      oItem := JsonObject():New()
      oItem["num"]     := AllTrim((cAlias)->C6_NUM)
      oItem["item"]    := AllTrim((cAlias)->C6_ITEM)
      oItem["produto"] := AllTrim((cAlias)->C6_PRODUTO)
      oItem["descri"]  := AllTrim((cAlias)->C6_DESCRI)
      oItem["qtdVen"]  := (cAlias)->C6_QTDVEN
      oItem["qtdEnt"]  := (cAlias)->C6_QTDENT
      oItem["prcVen"]  := (cAlias)->C6_PRCVEN
      oItem["valor"]   := (cAlias)->C6_VALOR
      oItem["blq"]     := AllTrim((cAlias)->C6_BLQ)
      aAdd(aItems, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResp := JsonObject():New()
  oResp["page"]    := nPage
  oResp["limit"]   := nPageSz
  oResp["items"]   := aItems
  oResp["hasNext"] := lHasNext

  ::SetResponse(oResp:ToJson())

  RestArea(aArea)
Return(lRet)

// =========================================================
// 6. CLIENTE (SA1) — busca unitaria
// GET /ClienteRest?codigo=000001
// =========================================================
WSRESTFUL ClienteRest DESCRIPTION "Cadastro de Cliente"
  WSDATA codigo AS STRING
  WSMETHOD GET DESCRIPTION "Retorna dados do cliente" ;
      WSSYNTAX "/ClienteRest?codigo={codigo}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE codigo WSSERVICE ClienteRest
  Local cCod  := Self:codigo
  Local oResp := JsonObject():New()
  Local aArea := GetArea()
  Local lRet  := .T.

  ::SetContentType("application/json")

  DbSelectArea("SA1")
  DbSetOrder(1)

  If DbSeek(xFilial("SA1") + cCod)
    oResp["codigo"]   := AllTrim(SA1->A1_COD)
    oResp["loja"]     := AllTrim(SA1->A1_LOJA)
    oResp["nome"]     := AllTrim(SA1->A1_NOME)
    oResp["cgc"]      := AllTrim(SA1->A1_CGC)
    oResp["risco"]    := AllTrim(SA1->A1_RISCO)
    oResp["limcred"]  := SA1->A1_LC
    oResp["vencred"]  := AllTrim(SA1->A1_VENCLC)
    oResp["bloqueio"] := AllTrim(SA1->A1_MSBLQL)
    ::SetResponse(oResp:ToJson())
  Else
    SetRestFault(404, "Cliente nao encontrado")
    lRet := .F.
  EndIf

  RestArea(aArea)
Return(lRet)

// =========================================================
// 7. PRODUTO (SB1) — busca unitaria
// GET /ProdutoRest?codigo=000001
// =========================================================
WSRESTFUL ProdutoRest DESCRIPTION "Cadastro de Produto"
  WSDATA codigo AS STRING
  WSMETHOD GET DESCRIPTION "Retorna dados do produto" ;
      WSSYNTAX "/ProdutoRest?codigo={codigo}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE codigo WSSERVICE ProdutoRest
  Local cCod  := Self:codigo
  Local oResp := JsonObject():New()
  Local aArea := GetArea()
  Local lRet  := .T.

  ::SetContentType("application/json")

  DbSelectArea("SB1")
  DbSetOrder(1)

  If DbSeek(xFilial("SB1") + cCod)
    oResp["codigo"]   := AllTrim(SB1->B1_COD)
    oResp["descri"]   := AllTrim(SB1->B1_DESC)
    oResp["tipo"]     := AllTrim(SB1->B1_TIPO)
    oResp["um"]       := AllTrim(SB1->B1_UM)
    oResp["grupo"]    := AllTrim(SB1->B1_GRUPO)
    oResp["bloqueio"] := AllTrim(SB1->B1_MSBLQL)
    ::SetResponse(oResp:ToJson())
  Else
    SetRestFault(404, "Produto nao encontrado")
    lRet := .F.
  EndIf

  RestArea(aArea)
Return(lRet)

//==========================================================
//  SPRINT 2 — FISCAL
//==========================================================

// =========================================================
// 8. NFs EMITIDAS (SF2) — paginacao Oracle
// GET /NfsEmitidasRest?cFil=01&cDtDe=20240101&cDtAte=20240131
// =========================================================
WSRESTFUL NfsEmitidasRest DESCRIPTION "Notas Fiscais Emitidas - SF2"
  WSDATA cDtDe     AS STRING
  WSDATA cDtAte    AS STRING
  WSDATA cFil      AS STRING
  WSDATA cDoc      AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Lista NFs emitidas com paginacao" ;
      WSSYNTAX "/NfsEmitidasRest?cFil={cFil}&cDtDe={cDtDe}&cDtAte={cDtAte}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFil, cDoc, nPage, nPageSize WSSERVICE NfsEmitidasRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cDtDe) .Or. Empty(Self:cDtAte)
    SetRestFault(400, "Parametros cDtDe e cDtAte sao obrigatorios (YYYYMMDD)")
    RestArea(aArea)
    Return .F.
  EndIf
  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT F2.F2_DOC, F2.F2_SERIE, F2.F2_CLIENTE, F2.F2_LOJA, "
  cQuery += "      F2.F2_EMISSAO, F2.F2_VALBRUT, F2.F2_VALFIS, F2.F2_CHVNFE "
  cQuery += "    FROM " + RetSqlName("SF2") + " F2 "
  cQuery += "    WHERE F2.D_E_L_E_T_ = ' ' "
  cQuery += "      AND F2.F2_FILIAL = '" + Self:cFil + "' "
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
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
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
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

// =========================================================
// 9. ITENS NF (SFT) — HIGH VOLUME, default 50
// GET /ItensNfRest?cFil=01&cDtDe=20240101&cDtAte=20240131
// =========================================================
WSRESTFUL ItensNfRest DESCRIPTION "Itens de Nota Fiscal - SFT010"
  WSDATA cDtDe     AS STRING
  WSDATA cDtAte    AS STRING
  WSDATA cFil      AS STRING
  WSDATA cNfiscal  AS STRING
  WSDATA cSerie    AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Lista itens de NF com paginacao" ;
      WSSYNTAX "/ItensNfRest?cFil={cFil}&cDtDe={cDtDe}&cDtAte={cDtAte}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFil, cNfiscal, cSerie, nPage, nPageSize WSSERVICE ItensNfRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 100, Self:nPageSize, 50)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cDtDe) .Or. Empty(Self:cDtAte)
    SetRestFault(400, "Parametros cDtDe e cDtAte sao obrigatorios (YYYYMMDD)")
    RestArea(aArea)
    Return .F.
  EndIf
  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT FT.FT_NFISCAL, FT.FT_SERIE, FT.FT_ITEM, FT.FT_PRODUTO, "
  cQuery += "      FT.FT_QUANT, FT.FT_PRCUNIT, FT.FT_VALCONT, "
  cQuery += "      FT.FT_ALIQICM, FT.FT_VALICM, FT.FT_ALIQIPI, FT.FT_VALIPI "
  cQuery += "    FROM " + RetSqlName("SFT") + " FT "
  cQuery += "    WHERE FT.D_E_L_E_T_ = ' ' "
  cQuery += "      AND FT.FT_FILIAL = '" + Self:cFil + "' "
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
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
      oItem := JsonObject():New()
      oItem["nfiscal"] := AllTrim((cAlias)->FT_NFISCAL)
      oItem["serie"]   := AllTrim((cAlias)->FT_SERIE)
      oItem["item"]    := AllTrim((cAlias)->FT_ITEM)
      oItem["produto"] := AllTrim((cAlias)->FT_PRODUTO)
      oItem["quant"]   := (cAlias)->FT_QUANT
      oItem["prcUni"]  := (cAlias)->FT_PRCUNIT
      oItem["valCont"] := (cAlias)->FT_VALCONT
      oItem["aliqIcm"] := (cAlias)->FT_ALIQICM
      oItem["valIcm"]  := (cAlias)->FT_VALICM
      oItem["aliqIpi"] := (cAlias)->FT_ALIQIPI
      oItem["valIpi"]  := (cAlias)->FT_VALIPI
      aAdd(aRet, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

// =========================================================
// 10. TES (SF4) — Tipos de Entrada/Saida
// GET /TesRest?cFil=01
// =========================================================
WSRESTFUL TesRest DESCRIPTION "Tipos de Entrada e Saida - SF4"
  WSDATA cFil      AS STRING
  WSDATA cCodigo   AS STRING
  WSDATA cTipo     AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Lista TES" ;
      WSSYNTAX "/TesRest?cFil={cFil}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cFil, cCodigo, cTipo, nPage, nPageSize WSSERVICE TesRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT F4.F4_CODIGO, F4.F4_TEXTO, F4.F4_TIPO, F4.F4_CF, "
  cQuery += "      F4.F4_ICM, F4.F4_IPI, F4.F4_ISS, F4.F4_CREDICM, F4.F4_CREDIPI "
  cQuery += "    FROM " + RetSqlName("SF4") + " F4 "
  cQuery += "    WHERE F4.D_E_L_E_T_ = ' ' AND F4.F4_FILIAL = '" + Self:cFil + "' "
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
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
      oItem := JsonObject():New()
      oItem["codigo"]  := AllTrim((cAlias)->F4_CODIGO)
      oItem["texto"]   := AllTrim((cAlias)->F4_TEXTO)
      oItem["tipo"]    := AllTrim((cAlias)->F4_TIPO)
      oItem["cfop"]    := AllTrim((cAlias)->F4_CF)
      oItem["icm"]     := AllTrim((cAlias)->F4_ICM)
      oItem["ipi"]     := AllTrim((cAlias)->F4_IPI)
      oItem["iss"]     := AllTrim((cAlias)->F4_ISS)
      oItem["credIcm"] := AllTrim((cAlias)->F4_CREDICM)
      oItem["credIpi"] := AllTrim((cAlias)->F4_CREDIPI)
      aAdd(aRet, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

// =========================================================
// 11. LIVROS FISCAIS (SFB) — paginacao Oracle
// GET /LivrosFiscaisRest?cFil=01&cDtDe=20240101&cDtAte=20240131
// =========================================================
WSRESTFUL LivrosFiscaisRest DESCRIPTION "Livros Fiscais - SFB"
  WSDATA cDtDe     AS STRING
  WSDATA cDtAte    AS STRING
  WSDATA cFil      AS STRING
  WSDATA cNfiscal  AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Lista livros fiscais com paginacao" ;
      WSSYNTAX "/LivrosFiscaisRest?cFil={cFil}&cDtDe={cDtDe}&cDtAte={cDtAte}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFil, cNfiscal, nPage, nPageSize WSSERVICE LivrosFiscaisRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cDtDe) .Or. Empty(Self:cDtAte)
    SetRestFault(400, "Parametros cDtDe e cDtAte sao obrigatorios (YYYYMMDD)")
    RestArea(aArea)
    Return .F.
  EndIf
  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT FB.FB_NFISCAL, FB.FB_SERIE, FB.FB_CLIFOR, FB.FB_LOJA, "
  cQuery += "      FB.FB_EMISSAO, FB.FB_BASEICM, FB.FB_VALICM, FB.FB_BASEIPI, FB.FB_VALIPI "
  cQuery += "    FROM " + RetSqlName("SFB") + " FB "
  cQuery += "    WHERE FB.D_E_L_E_T_ = ' ' "
  cQuery += "      AND FB.FB_FILIAL = '" + Self:cFil + "' "
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
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
      oItem := JsonObject():New()
      oItem["nfiscal"]  := AllTrim((cAlias)->FB_NFISCAL)
      oItem["serie"]    := AllTrim((cAlias)->FB_SERIE)
      oItem["clifor"]   := AllTrim((cAlias)->FB_CLIFOR)
      oItem["loja"]     := AllTrim((cAlias)->FB_LOJA)
      oItem["emissao"]  := AllTrim((cAlias)->FB_EMISSAO)
      oItem["baseIcm"]  := (cAlias)->FB_BASEICM
      oItem["valorIcm"] := (cAlias)->FB_VALICM
      oItem["baseIpi"]  := (cAlias)->FB_BASEIPI
      oItem["valorIpi"] := (cAlias)->FB_VALIPI
      aAdd(aRet, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

//==========================================================
//  SPRINT 3 — CONTABIL
//==========================================================

// =========================================================
// 12. LANCAMENTOS CONTABEIS (CT2) — CRITICAL TABLE
// GET /LancamentosContabeisRest?cFil=01&cDtDe=20240101&cDtAte=20240131
// =========================================================
WSRESTFUL LancamentosContabeisRest DESCRIPTION "Lancamentos Contabeis - CT2"
  WSDATA cDtDe     AS STRING
  WSDATA cDtAte    AS STRING
  WSDATA cFil      AS STRING
  WSDATA cDebito   AS STRING
  WSDATA cCredito  AS STRING
  WSDATA cLote     AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Lista lancamentos contabeis" ;
      WSSYNTAX "/LancamentosContabeisRest?cFil={cFil}&cDtDe={cDtDe}&cDtAte={cDtAte}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFil, cDebito, cCredito, cLote, nPage, nPageSize WSSERVICE LancamentosContabeisRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cDtDe) .Or. Empty(Self:cDtAte)
    SetRestFault(400, "Parametros cDtDe e cDtAte sao obrigatorios (YYYYMMDD)")
    RestArea(aArea)
    Return .F.
  EndIf
  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT CT2.CT2_DATA, CT2.CT2_DEBITO, CT2.CT2_CREDIT, "
  cQuery += "      CT2.CT2_VALOR, CT2.CT2_HIST, CT2.CT2_CCD, CT2.CT2_CCC, CT2.CT2_LOTE "
  cQuery += "    FROM " + RetSqlName("CT2") + " CT2 "
  cQuery += "    WHERE CT2.D_E_L_E_T_ = ' ' "
  cQuery += "      AND CT2.CT2_FILIAL = '" + Self:cFil + "' "
  cQuery += "      AND CT2.CT2_DATA >= '" + Self:cDtDe + "' "
  cQuery += "      AND CT2.CT2_DATA <= '" + Self:cDtAte + "' "
  If !Empty(Self:cDebito)
    cQuery += "      AND CT2.CT2_DEBITO = '" + Self:cDebito + "' "
  EndIf
  If !Empty(Self:cCredito)
    cQuery += "      AND CT2.CT2_CREDIT = '" + Self:cCredito + "' "
  EndIf
  If !Empty(Self:cLote)
    cQuery += "      AND CT2.CT2_LOTE = '" + Self:cLote + "' "
  EndIf
  cQuery += "    ORDER BY CT2.CT2_DATA DESC, CT2.CT2_DEBITO, CT2.CT2_CREDIT "
  cQuery += "  ) T WHERE ROWNUM <= " + cValToChar(nOffset + nPgSz + 1) + " "
  cQuery += ") WHERE RNUM > " + cValToChar(nOffset) + " "

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)
  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      nCount++
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
      oItem := JsonObject():New()
      oItem["data"]      := AllTrim((cAlias)->CT2_DATA)
      oItem["debito"]    := AllTrim((cAlias)->CT2_DEBITO)
      oItem["credito"]   := AllTrim((cAlias)->CT2_CREDIT)
      oItem["valor"]     := (cAlias)->CT2_VALOR
      oItem["historico"] := AllTrim((cAlias)->CT2_HIST)
      oItem["ccDebito"]  := AllTrim((cAlias)->CT2_CCD)
      oItem["ccCredito"] := AllTrim((cAlias)->CT2_CCC)
      oItem["lote"]      := AllTrim((cAlias)->CT2_LOTE)
      aAdd(aRet, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

// =========================================================
// 13. BALANCETE CONTABIL (CT1/CTT/CT2)
// GET /BalanceteRest?cFil=01&cDtDe=20240101&cDtAte=20240131
// =========================================================
WSRESTFUL BalanceteRest DESCRIPTION "Balancete Contabil - CT1/CTT/CT2"
  WSDATA cDtDe     AS STRING
  WSDATA cDtAte    AS STRING
  WSDATA cFil      AS STRING
  WSDATA cConta    AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Retorna balancete contabil" ;
      WSSYNTAX "/BalanceteRest?cFil={cFil}&cDtDe={cDtDe}&cDtAte={cDtAte}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cDtDe, cDtAte, cFil, cConta, nPage, nPageSize WSSERVICE BalanceteRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cDtDe) .Or. Empty(Self:cDtAte)
    SetRestFault(400, "Parametros cDtDe e cDtAte sao obrigatorios (YYYYMMDD)")
    RestArea(aArea)
    Return .F.
  EndIf
  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT CT1.CT1_CONTA, CT1.CT1_DESC01, CTT.CTT_CLASSE, "
  cQuery += "      NVL(SUM(CASE WHEN CT2.CT2_DEBITO = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS TOTAL_DEBITO, "
  cQuery += "      NVL(SUM(CASE WHEN CT2.CT2_CREDIT = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS TOTAL_CREDITO "
  cQuery += "    FROM " + RetSqlName("CT1") + " CT1 "
  cQuery += "    LEFT JOIN " + RetSqlName("CTT") + " CTT "
  cQuery += "      ON CTT.CTT_CUSTO = CT1.CT1_CONTA AND CTT.D_E_L_E_T_ = ' ' AND CTT.CTT_BLOQ <> '1' "
  cQuery += "    LEFT JOIN " + RetSqlName("CT2") + " CT2 "
  cQuery += "      ON (CT2.CT2_DEBITO = CT1.CT1_CONTA OR CT2.CT2_CREDIT = CT1.CT1_CONTA) "
  cQuery += "      AND CT2.D_E_L_E_T_ = ' ' AND CT2.CT2_FILIAL = '" + Self:cFil + "' "
  cQuery += "      AND CT2.CT2_DATA >= '" + Self:cDtDe + "' AND CT2.CT2_DATA <= '" + Self:cDtAte + "' "
  cQuery += "    WHERE CT1.D_E_L_E_T_ = ' ' AND CT1.CT1_FILIAL = '" + Self:cFil + "' "
  If !Empty(Self:cConta)
    cQuery += "      AND CT1.CT1_CONTA LIKE '" + Self:cConta + "%' "
  EndIf
  cQuery += "    GROUP BY CT1.CT1_CONTA, CT1.CT1_DESC01, CTT.CTT_CLASSE "
  cQuery += "    ORDER BY CT1.CT1_CONTA "
  cQuery += "  ) T WHERE ROWNUM <= " + cValToChar(nOffset + nPgSz + 1) + " "
  cQuery += ") WHERE RNUM > " + cValToChar(nOffset) + " "

  dbUseArea(.T., "TOPCONN", TCGenQry(,,cQuery), cAlias, .F., .T.)
  If Select(cAlias) > 0
    Do While !(cAlias)->(EoF())
      nCount++
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
      oItem := JsonObject():New()
      oItem["conta"]        := AllTrim((cAlias)->CT1_CONTA)
      oItem["descricao"]    := AllTrim((cAlias)->CT1_DESC01)
      oItem["classe"]       := AllTrim((cAlias)->CTT_CLASSE)
      oItem["totalDebito"]  := (cAlias)->TOTAL_DEBITO
      oItem["totalCredito"] := (cAlias)->TOTAL_CREDITO
      oItem["saldo"]        := (cAlias)->TOTAL_DEBITO - (cAlias)->TOTAL_CREDITO
      aAdd(aRet, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

// =========================================================
// 14. PLANO DE CONTAS (CTT)
// GET /PlanoContasRest?cFil=01
// =========================================================
WSRESTFUL PlanoContasRest DESCRIPTION "Plano de Contas - CTT"
  WSDATA cFil      AS STRING
  WSDATA cCusto    AS STRING
  WSDATA cClasse   AS STRING
  WSDATA nPage     AS INTEGER
  WSDATA nPageSize AS INTEGER
  WSMETHOD GET DESCRIPTION "Lista centros de custo" ;
      WSSYNTAX "/PlanoContasRest?cFil={cFil}"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cFil, cCusto, cClasse, nPage, nPageSize WSSERVICE PlanoContasRest
  Local aRet     := {}
  Local lHasNext := .F.
  Local aArea    := GetArea()
  Local nPg      := IIf(Self:nPage > 0, Self:nPage, 1)
  Local nPgSz    := IIf(Self:nPageSize > 0 .And. Self:nPageSize <= 200, Self:nPageSize, 100)
  Local nOffset  := (nPg - 1) * nPgSz
  Local cQuery   := ""
  Local cAlias   := GetNextAlias()
  Local nCount   := 0
  Local oItem, oResponse
  Local lRet     := .T.

  ::SetContentType("application/json")

  If Empty(Self:cFil)
    SetRestFault(400, "Parametro cFil eh obrigatorio")
    RestArea(aArea)
    Return .F.
  EndIf

  cQuery := "SELECT * FROM ( "
  cQuery += "  SELECT ROWNUM AS RNUM, T.* FROM ( "
  cQuery += "    SELECT CTT.CTT_CUSTO, CTT.CTT_DESC01, CTT.CTT_CLASSE, CTT.CTT_BLOQ, CTT.CTT_CCSUP "
  cQuery += "    FROM " + RetSqlName("CTT") + " CTT "
  cQuery += "    WHERE CTT.D_E_L_E_T_ = ' ' AND CTT.CTT_FILIAL = '" + Self:cFil + "' "
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
      If nCount > nPgSz ; lHasNext := .T. ; Exit ; EndIf
      oItem := JsonObject():New()
      oItem["custo"]     := AllTrim((cAlias)->CTT_CUSTO)
      oItem["descricao"] := AllTrim((cAlias)->CTT_DESC01)
      oItem["classe"]    := AllTrim((cAlias)->CTT_CLASSE)
      oItem["bloqueio"]  := AllTrim((cAlias)->CTT_BLOQ)
      oItem["superior"]  := AllTrim((cAlias)->CTT_CCSUP)
      aAdd(aRet, oItem)
      (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())
  EndIf

  oResponse := JsonObject():New()
  oResponse["page"] := nPg ; oResponse["limit"] := nPgSz
  oResponse["items"] := aRet ; oResponse["hasNext"] := lHasNext
  ::SetResponse(oResponse:ToJson())
  RestArea(aArea)
Return(lRet)

//==========================================================
//  SPRINT 4 — QUERY GENERICA
//==========================================================

// =========================================================
// 15. QUERY REST GENERICA (SELECT only)
// GET /QueryRest?cQuery=SELECT...
// POST /QueryRest  body: {"query":"SELECT..."}
// =========================================================
WSRESTFUL QueryRest DESCRIPTION "Generic Query Execution API"
  WSDATA cQuery AS STRING
  WSMETHOD GET DESCRIPTION "Execute a SELECT query via URL parameter"
  WSMETHOD POST DESCRIPTION "Execute a SELECT query via POST body"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cQuery WSSERVICE QueryRest
  Local aRet      := {}
  Local aStruct   := {}
  Local cAlias    := GetNextAlias()
  Local nX        := 0
  Local cCleanQry := Self:cQuery
  Local aArea     := GetArea()
  Local lRet      := .T.
  Local oRow
  Local cFld
  Local cTyp
  Local xVal
  Local bErroA
  Local cComando  := ""
  Local aComando  := {}
  Local cNoSelect := ""
  Private cErroQry := ""

  ::SetContentType("application/json")

  If Empty(cCleanQry)
    SetRestFault(400, "query parameter is required")
    RestArea(aArea)
    Return .F.
  EndIf

  cCleanQry := AllTrim(cCleanQry)
  cComando  := Upper(Left(cCleanQry, At(" ", cCleanQry) - 1))
  If Empty(cComando)
    cComando := Upper(cCleanQry)
  EndIf

  bErroA := ErrorBlock( { |oErro| ChkErrQry( oErro ) } )
  Begin Sequence
    If ! (cComando == "SELECT")
      cNoSelect := StrTran(cCleanQry, CRLF, " ")
      cNoSelect := AllTrim(cNoSelect)
      If Right(cNoSelect, 1) == ";"
        cNoSelect := Left(cNoSelect, Len(cNoSelect) - 1)
      EndIf

      aComando := StrTokArr(cNoSelect, ";")
      For nX := 1 To Len(aComando)
        If TcSqlExec(aComando[nX]) < 0
          cErroQry := "TCSQLError(): " + TCSQLError()
          Break
        EndIf
      Next
      TcSQLExec("COMMIT")

      ::SetResponse('{"status":"success", "affected_commands":' + cValToChar(Len(aComando)) + '}')
    Else
      dbUseArea(.T., "TOPCONN", TCGenQry(,, cCleanQry), cAlias, .F., .T.)
      If Select(cAlias) > 0
        aStruct := (cAlias)->(dbStruct())
        Do While !(cAlias)->(EoF())
          oRow := JsonObject():New()
          For nX := 1 To Len(aStruct)
            cFld := aStruct[nX, 1]
            cTyp := aStruct[nX, 2]
            xVal := (cAlias)->&(cFld)
            If cTyp == "C"     ; oRow[cFld] := AllTrim(xVal)
            ElseIf cTyp == "N" ; oRow[cFld] := xVal
            ElseIf cTyp == "D" ; oRow[cFld] := DToC(xVal)
            ElseIf cTyp == "L" ; oRow[cFld] := xVal
            EndIf
          Next
          aAdd(aRet, oRow)
          (cAlias)->(DbSkip())
        EndDo
        (cAlias)->(DbCloseArea())
      EndIf
      ::SetResponse(FWJsonSerialize(aRet))
    EndIf
  End Sequence
  ErrorBlock(bErroA)

  If ! Empty(cErroQry)
    SetRestFault(500, cErroQry)
    lRet := .F.
  EndIf

  RestArea(aArea)
Return(lRet)

WSMETHOD POST WSRECEIVE cQuery WSSERVICE QueryRest
  Local aRet      := {}
  Local aStruct   := {}
  Local cAlias    := GetNextAlias()
  Local nX        := 0
  Local cCleanQry := ""
  Local oJsonObj  := Nil
  Local aArea     := GetArea()
  Local lRet      := .T.
  Local oRow
  Local cFld
  Local cTyp
  Local xVal
  Local cBody
  Local bErroA
  Local cComando  := ""
  Local aComando  := {}
  Local cNoSelect := ""
  Private cErroQry := ""

  ::SetContentType("application/json")

  cBody := Self:GetContent()
  If !Empty(cBody)
    FWJsonDeserialize(cBody, @oJsonObj)
    If oJsonObj != Nil
      cCleanQry := oJsonObj:QUERY
    EndIf
  EndIf

  If Empty(cCleanQry)
    cCleanQry := Self:cQuery
  EndIf

  If Empty(cCleanQry)
    SetRestFault(400, "query parameter or body is required")
    RestArea(aArea)
    Return .F.
  EndIf

  cCleanQry := AllTrim(cCleanQry)
  cComando  := Upper(Left(cCleanQry, At(" ", cCleanQry) - 1))
  If Empty(cComando)
    cComando := Upper(cCleanQry)
  EndIf

  bErroA := ErrorBlock( { |oErro| ChkErrQry( oErro ) } )
  Begin Sequence
    If ! (cComando == "SELECT")
      cNoSelect := StrTran(cCleanQry, CRLF, " ")
      cNoSelect := AllTrim(cNoSelect)
      If Right(cNoSelect, 1) == ";"
        cNoSelect := Left(cNoSelect, Len(cNoSelect) - 1)
      EndIf

      aComando := StrTokArr(cNoSelect, ";")
      For nX := 1 To Len(aComando)
        If TcSqlExec(aComando[nX]) < 0
          cErroQry := "TCSQLError(): " + TCSQLError()
          Break
        EndIf
      Next
      TcSQLExec("COMMIT")

      ::SetResponse('{"status":"success", "affected_commands":' + cValToChar(Len(aComando)) + '}')
    Else
      dbUseArea(.T., "TOPCONN", TCGenQry(,, cCleanQry), cAlias, .F., .T.)
      If Select(cAlias) > 0
        aStruct := (cAlias)->(dbStruct())
        Do While !(cAlias)->(EoF())
          oRow := JsonObject():New()
          For nX := 1 To Len(aStruct)
            cFld := aStruct[nX, 1]
            cTyp := aStruct[nX, 2]
            xVal := (cAlias)->&(cFld)
            If cTyp == "C"     ; oRow[cFld] := AllTrim(xVal)
            ElseIf cTyp == "N" ; oRow[cFld] := xVal
            ElseIf cTyp == "D" ; oRow[cFld] := DToC(xVal)
            ElseIf cTyp == "L" ; oRow[cFld] := xVal
            Endif
          Next
          aAdd(aRet, oRow)
          (cAlias)->(DbSkip())
        EndDo
        (cAlias)->(DbCloseArea())
      EndIf
      ::SetResponse(FWJsonSerialize(aRet))
    EndIf
  End Sequence
  ErrorBlock(bErroA)

  If ! Empty(cErroQry)
    SetRestFault(500, cErroQry)
    lRet := .F.
  EndIf

  RestArea(aArea)
Return(lRet)

/*
|--------------------------------------------------------------------------
| Funcao Auxiliar: ChkErrQry
| Captura erros ocorridos na execucao SQL para evitar queda da thread REST.
|--------------------------------------------------------------------------
*/
Static Function ChkErrQry(oErro)
  Private cErroQry
  cErroQry := '(' + Alltrim( Str( oErro:GenCode ) ) + ') : ' + AllTrim( oErro:Description )
  Break
Return

