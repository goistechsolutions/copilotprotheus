//----------------------------------------------------------
// COPILOT_PAGINATION.PRW
// Template de paginação para endpoints REST do Copilot Protheus
// Compatível com Oracle, MSSQL e DB2
// Sprint 2 — Copilot Protheus
//----------------------------------------------------------
#Include 'Protheus.ch'
#Include 'RestFul.ch'

//----------------------------------------------------------
// Função utilitária: lê page e pageSize da query string
// Retorna array { nPage, nPageSize, nOffset }
//----------------------------------------------------------
Static Function uPagParams(oRequest)
    Local nPage     := Val(oRequest:getQueryParam('page',     '1'))
    Local nPageSize := Val(oRequest:getQueryParam('pageSize', '100'))

    // Proteções mínimas
    If nPage     < 1  ; nPage     := 1   ; EndIf
    If nPageSize < 1  ; nPageSize := 1   ; EndIf
    If nPageSize > 500; nPageSize := 500 ; EndIf  // teto de segurança

    Return { nPage, nPageSize, (nPage - 1) * nPageSize }

//----------------------------------------------------------
// Função utilitária: monta envelope padrão de resposta paginada
//----------------------------------------------------------
Static Function uPagEnvelope(aItems, nPage, nPageSize, nTotal)
    Local oResp := JsonObject():New()
    Local nTotalPages := Int((nTotal + nPageSize - 1) / nPageSize)

    oResp['items']       := aItems
    oResp['page']        := nPage
    oResp['pageSize']    := nPageSize
    oResp['total']       := nTotal
    oResp['totalPages']  := nTotalPages
    oResp['hasNext']     := (nPage < nTotalPages)
    oResp['hasPrev']     := (nPage > 1)

    Return oResp

//----------------------------------------------------------
// GET /protheus/pedidos?page=1&pageSize=50&filial=01
//----------------------------------------------------------
WSRestFul CopilotPedidos Description "Consulta paginada de Pedidos de Venda (SC5)"
    WsMethod GET Description "Lista pedidos com paginação"
EndWsRestFul

WsMethod GET WsReceive oRequest WsSend oResponse CopilotPedidos
    Local aPagParams := uPagParams(oRequest)
    Local nPage      := aPagParams[1]
    Local nPageSize  := aPagParams[2]
    Local nOffset    := aPagParams[3]
    Local cFilial    := oRequest:getQueryParam('filial', xFilial('SC5'))
    Local aItems     := {}
    Local nTotal     := 0
    Local nSkipped   := 0
    Local nRead      := 0
    Local oItem      := Nil

    DbSelectArea('SC5')
    SC5->(DbSetOrder(1))  // Índice por filial+num
    DbSeek(xFilial('SC5'))

    // Contar total (apenas registros válidos da filial)
    While !SC5->(EoF()) .And. SC5->C5_FILIAL == cFilial
        If SC5->D_E_L_E_T_ == ' '
            nTotal++
        EndIf
        SC5->(DbSkip())
    EndDo

    // Reposicionar para leitura paginada
    SC5->(DbSetOrder(1))
    DbSeek(xFilial('SC5'))

    While !SC5->(EoF()) .And. SC5->C5_FILIAL == cFilial .And. nRead < nPageSize
        If SC5->D_E_L_E_T_ == ' '
            If nSkipped < nOffset
                nSkipped++
            Else
                oItem := JsonObject():New()
                oItem['num']      := AllTrim(SC5->C5_NUM)
                oItem['cliente']  := AllTrim(SC5->C5_CLIENTE)
                oItem['emissao']  := AllTrim(SC5->C5_EMISSAO)
                oItem['nota']     := AllTrim(SC5->C5_NOTA)
                oItem['bloquei']  := AllTrim(SC5->C5_BLOQUEI)
                oItem['filial']   := AllTrim(SC5->C5_FILIAL)
                AAdd(aItems, oItem)
                nRead++
            EndIf
        EndIf
        SC5->(DbSkip())
    EndDo

    oResponse:setResponse(uPagEnvelope(aItems, nPage, nPageSize, nTotal):toJson())
    oResponse:setStatus(200)

Return .T.

//----------------------------------------------------------
// GET /protheus/titulos?page=1&pageSize=50&filial=01
//----------------------------------------------------------
WSRestFul CopilotTitulos Description "Consulta paginada de Títulos a Receber (SE1)"
    WsMethod GET Description "Lista títulos com paginação"
EndWsRestFul

WsMethod GET WsReceive oRequest WsSend oResponse CopilotTitulos
    Local aPagParams := uPagParams(oRequest)
    Local nPage      := aPagParams[1]
    Local nPageSize  := aPagParams[2]
    Local nOffset    := aPagParams[3]
    Local cFilial    := oRequest:getQueryParam('filial', xFilial('SE1'))
    Local aItems     := {}
    Local nTotal     := 0
    Local nSkipped   := 0
    Local nRead      := 0
    Local oItem      := Nil

    DbSelectArea('SE1')
    SE1->(DbSetOrder(1))
    DbSeek(xFilial('SE1'))

    While !SE1->(EoF()) .And. SE1->E1_FILIAL == cFilial
        If SE1->D_E_L_E_T_ == ' '
            nTotal++
        EndIf
        SE1->(DbSkip())
    EndDo

    SE1->(DbSetOrder(1))
    DbSeek(xFilial('SE1'))

    While !SE1->(EoF()) .And. SE1->E1_FILIAL == cFilial .And. nRead < nPageSize
        If SE1->D_E_L_E_T_ == ' '
            If nSkipped < nOffset
                nSkipped++
            Else
                oItem := JsonObject():New()
                oItem['num']     := AllTrim(SE1->E1_NUM)
                oItem['cliente'] := AllTrim(SE1->E1_CLIENTE)
                oItem['vencto']  := AllTrim(SE1->E1_VENCTO)
                oItem['valor']   := SE1->E1_VALOR
                oItem['saldo']   := SE1->E1_SALDO
                oItem['tipo']    := AllTrim(SE1->E1_TIPO)
                AAdd(aItems, oItem)
                nRead++
            EndIf
        EndIf
        SE1->(DbSkip())
    EndDo

    oResponse:setResponse(uPagEnvelope(aItems, nPage, nPageSize, nTotal):toJson())
    oResponse:setStatus(200)

Return .T.

//----------------------------------------------------------
// GET /protheus/saldos?page=1&pageSize=50&filial=01
//----------------------------------------------------------
WSRestFul CopilotSaldos Description "Consulta paginada de Saldos em Estoque (SB2)"
    WsMethod GET Description "Lista saldos com paginação"
EndWsRestFul

WsMethod GET WsReceive oRequest WsSend oResponse CopilotSaldos
    Local aPagParams := uPagParams(oRequest)
    Local nPage      := aPagParams[1]
    Local nPageSize  := aPagParams[2]
    Local nOffset    := aPagParams[3]
    Local cFilial    := oRequest:getQueryParam('filial', xFilial('SB2'))
    Local aItems     := {}
    Local nTotal     := 0
    Local nSkipped   := 0
    Local nRead      := 0
    Local oItem      := Nil

    DbSelectArea('SB2')
    SB2->(DbSetOrder(1))
    DbSeek(xFilial('SB2'))

    While !SB2->(EoF()) .And. SB2->B2_FILIAL == cFilial
        If SB2->D_E_L_E_T_ == ' ' .And. SB2->B2_QATU > 0
            nTotal++
        EndIf
        SB2->(DbSkip())
    EndDo

    SB2->(DbSetOrder(1))
    DbSeek(xFilial('SB2'))

    While !SB2->(EoF()) .And. SB2->B2_FILIAL == cFilial .And. nRead < nPageSize
        If SB2->D_E_L_E_T_ == ' ' .And. SB2->B2_QATU > 0
            If nSkipped < nOffset
                nSkipped++
            Else
                oItem := JsonObject():New()
                oItem['cod']    := AllTrim(SB2->B2_COD)
                oItem['filial'] := AllTrim(SB2->B2_FILIAL)
                oItem['qatu']   := SB2->B2_QATU
                oItem['qmin']   := SB2->B2_QMIN
                oItem['cm1']    := SB2->B2_CM1
                AAdd(aItems, oItem)
                nRead++
            EndIf
        EndIf
        SB2->(DbSkip())
    EndDo

    oResponse:setResponse(uPagEnvelope(aItems, nPage, nPageSize, nTotal):toJson())
    oResponse:setStatus(200)

Return .T.

//----------------------------------------------------------
// GET /protheus/compras?page=1&pageSize=50&filial=01
//----------------------------------------------------------
WSRestFul CopilotCompras Description "Consulta paginada de Pedidos de Compra (SC7)"
    WsMethod GET Description "Lista pedidos de compra com paginação"
EndWsRestFul

WsMethod GET WsReceive oRequest WsSend oResponse CopilotCompras
    Local aPagParams := uPagParams(oRequest)
    Local nPage      := aPagParams[1]
    Local nPageSize  := aPagParams[2]
    Local nOffset    := aPagParams[3]
    Local cFilial    := oRequest:getQueryParam('filial', xFilial('SC7'))
    Local aItems     := {}
    Local nTotal     := 0
    Local nSkipped   := 0
    Local nRead      := 0
    Local oItem      := Nil

    DbSelectArea('SC7')
    SC7->(DbSetOrder(1))
    DbSeek(xFilial('SC7'))

    While !SC7->(EoF()) .And. SC7->C7_FILIAL == cFilial
        If SC7->D_E_L_E_T_ == ' '
            nTotal++
        EndIf
        SC7->(DbSkip())
    EndDo

    SC7->(DbSetOrder(1))
    DbSeek(xFilial('SC7'))

    While !SC7->(EoF()) .And. SC7->C7_FILIAL == cFilial .And. nRead < nPageSize
        If SC7->D_E_L_E_T_ == ' '
            If nSkipped < nOffset
                nSkipped++
            Else
                oItem := JsonObject():New()
                oItem['num']     := AllTrim(SC7->C7_NUM)
                oItem['fornece'] := AllTrim(SC7->C7_FORNECE)
                oItem['produto'] := AllTrim(SC7->C7_PRODUTO)
                oItem['quant']   := SC7->C7_QUANT
                oItem['datprf']  := AllTrim(SC7->C7_DATPRF)
                oItem['residuo'] := SC7->C7_RESIDUO
                AAdd(aItems, oItem)
                nRead++
            EndIf
        EndIf
        SC7->(DbSkip())
    EndDo

    oResponse:setResponse(uPagEnvelope(aItems, nPage, nPageSize, nTotal):toJson())
    oResponse:setStatus(200)

Return .T.

//----------------------------------------------------------
// GET /protheus/itenspedido?num=000123&page=1&pageSize=50&filial=01
//----------------------------------------------------------
WSRestFul CopilotItensPedido Description "Consulta paginada de Itens de Pedido de Venda (SC6)"
    WsMethod GET Description "Lista itens de pedido com paginação"
EndWsRestFul

WsMethod GET WsReceive oRequest WsSend oResponse CopilotItensPedido
    Local aPagParams := uPagParams(oRequest)
    Local nPage      := aPagParams[1]
    Local nPageSize  := aPagParams[2]
    Local nOffset    := aPagParams[3]
    Local cFilial    := oRequest:getQueryParam('filial',  xFilial('SC6'))
    Local cNum       := AllTrim(oRequest:getQueryParam('num', ''))
    Local aItems     := {}
    Local nTotal     := 0
    Local nSkipped   := 0
    Local nRead      := 0
    Local oItem      := Nil
    Local oErr       := Nil

    // num é obrigatório — sem ele o resultado não tem sentido
    If Empty(cNum)
        oErr := JsonObject():New()
        oErr['error'] := 'Parâmetro "num" é obrigatório.'
        oResponse:setResponse(oErr:toJson())
        oResponse:setStatus(400)
        Return .T.
    EndIf

    DbSelectArea('SC6')
    SC6->(DbSetOrder(1))  // Índice por filial + num + item
    DbSeek(xFilial('SC6') + cNum)

    // Contagem total para o envelope
    While !SC6->(EoF()) .And. SC6->C6_FILIAL == cFilial .And. AllTrim(SC6->C6_NUM) == cNum
        If SC6->D_E_L_E_T_ == ' '
            nTotal++
        EndIf
        SC6->(DbSkip())
    EndDo

    // Reposiciona para leitura paginada
    SC6->(DbSetOrder(1))
    DbSeek(xFilial('SC6') + cNum)

    While !SC6->(EoF()) .And. SC6->C6_FILIAL == cFilial .And. AllTrim(SC6->C6_NUM) == cNum .And. nRead < nPageSize
        If SC6->D_E_L_E_T_ == ' '
            If nSkipped < nOffset
                nSkipped++
            Else
                oItem := JsonObject():New()
                oItem['num']    := AllTrim(SC6->C6_NUM)
                oItem['item']   := AllTrim(SC6->C6_ITEM)
                oItem['prod']   := AllTrim(SC6->C6_PRODUTO)
                oItem['descri'] := AllTrim(SC6->C6_DESCRI)
                oItem['qtdven'] := SC6->C6_QTDVEN
                oItem['qtdent'] := SC6->C6_QTDENT
                oItem['prcven'] := SC6->C6_PRCVEN
                oItem['saldo']  := SC6->C6_QTDVEN - SC6->C6_QTDENT  // campo calculado
                AAdd(aItems, oItem)
                nRead++
            EndIf
        EndIf
        SC6->(DbSkip())
    EndDo

    oResponse:setResponse(uPagEnvelope(aItems, nPage, nPageSize, nTotal):toJson())
    oResponse:setStatus(200)

Return .T.
