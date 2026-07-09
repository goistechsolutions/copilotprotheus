#INCLUDE "TOTVS.CH"
#INCLUDE "RESTFUL.CH"

/*/{Protheus.doc} API_Copilot
API REST Customizada para o projeto CopilotProtheus.
Centraliza as consultas de BI, Relatórios e Insights Gerenciais para consumo do Gemini.

@type        class
@author      CopilotProtheus Team
@since       09/07/2026
@version     1.0
/*/
WSRESTFUL copilot DESCRIPTION "API de Integração Analytics - CopilotProtheus"
    
    // Parâmetros de URL/Query recebidos do Backend (Hetzner)
    WSDATA page         AS INTEGER OPTIONAL
    WSDATA pageSize     AS INTEGER OPTIONAL
    WSDATA queryId      AS STRING  OPTIONAL
    WSDATA filterValue  AS STRING  OPTIONAL

    // Definição do Método GET para busca de dados
    WSMETHOD GET query;
        DESCRIPTION "Executa consultas estruturadas no dicionário e tabelas do Protheus";
        WSSYNTAX "/copilot/query" PATH "/api/v1/copilot/query"
        
END WSRESTFUL

WSMETHOD GET query WSSERVICE copilot
    Local lRet          := .T.
    Local cQueryId      := Upper(AllTrim(Self:queryId))
    Local nPage         := If(Self:page == Nil, 1, Self:page)
    Local nPageSize     := If(Self:pageSize == Nil, 50, Self:pageSize)
    Local cFilterValue  := If(Self:filterValue == Nil, "", Upper(AllTrim(Self:filterValue)))
    Local cSql          := ""
    Local cAliasRes     := ""
    Local oJsonResult   := JsonObject():New()
    Local aData         := {}
    Local oRow          := Nil
    Local nI            := 0
    Local cField        := ""
    Local xVal          := Nil
    Local aFields       := {}
    Local nStartRow     := ((nPage - 1) * nPageSize) + 1
    Local nEndRow       := nPage * nPageSize
    Local nCurrRow      := 0

    // Força o retorno da resposta em formato JSON UTF-8
    Self:SetContentType("application/json")

    // Validação de segurança obrigatória
    If Empty(cQueryId)
        SetRestFault(400, "O parametro 'queryId' e obrigatorio para identificar a analise requisitada.")
        Return .F.
    EndIf

    // -------------------------------------------------------------------------
    // CATÁLOGO DE QUERIES SEgURAS (Adicione aqui suas visões de negócios)
    // -------------------------------------------------------------------------
    Do Case
        Case cQueryId == "FAT_POR_FILIAL"
            // Retorna o faturamento bruto agrupado por filial logada
            cSql := "SELECT F2_FILIAL AS FILIAL, SUM(F2_VALMERC) AS VALOR_MERC, SUM(F2_VALBRUT) AS VALOR_BRUTO "
            cSql += "FROM " + RetSQLName("SF2") + " "
            cSql += "WHERE F2_FILIAL >= '" + xFilial("SF2") + "' AND D_E_L_E_T_ = ' ' "
            If !Empty(cFilterValue)
                cSql += "AND F2_EMISSÃO >= '" + cFilterValue + "' " // Filtro por data vindo da requisição
            EndIf
            cSql += "GROUP BY F2_FILIAL "
            cSql += "ORDER BY VALOR_BRUTO DESC "

        Case cQueryId == "TOP_CLIENTES"
            // Retorna os maiores clientes com limite de crédito em aberto
            cSql := "SELECT A1_COD AS CODIGO, A1_LOJA AS LOJA, A1_NOME AS NOME, A1_VALMERC AS COMPRAS_MES "
            cSql += "FROM " + RetSQLName("SA1") + " "
            cSql += "WHERE A1_FILIAL = '" + xFilial("SA1") + "' AND D_E_L_E_T_ = ' ' "
            If !Empty(cFilterValue)
                cSql += "AND A1_EST = '" + cFilterValue + "' " // Filtro por Estado (UF)
            EndIf
            cSql += "ORDER BY A1_VALMERC DESC "

        Case cQueryId == "CURVA_ABC_PRODUTOS"
            // Análise de movimentação de estoque/vendas
            cSql := "SELECT D2_COD AS PRODUTO, D2_UM AS UNIDADE, SUM(D2_QUANT) AS QTD_VENDIDA, SUM(D2_TOTAL) AS TOTAL_FAT "
            cSql += "FROM " + RetSQLName("SD2") + " "
            cSql += "WHERE D2_FILIAL = '" + xFilial("SD2") + "' AND D_E_L_E_T_ = ' ' "
            cSql += "GROUP BY D2_COD, D2_UM "
            cSql += "ORDER BY TOTAL_FAT DESC "

        Otherwise
            SetRestFault(404, "A analise '" + cQueryId + "' nao esta homologada no catalogo do CopilotProtheus.")
            Return .F.
    EndCase

    // -------------------------------------------------------------------------
    // EXECUÇÃO DA CONSULTA NO BANCO DE DADOS (USANDO DRIVER CORPORATIVO)
    // -------------------------------------------------------------------------
    cAliasRes := MPSysOpenQuery(cSql)

    // Caso a query retorne vazia
    If (cAliasRes)->(Eof())
        oJsonResult["totalRecords"] := 0
        oJsonResult["page"]         := nPage
        oJsonResult["items"]        := {}
        Self:SetResponse(oJsonResult:ToJson())
        (cAliasRes)->(CloseArea())
        Return .T.
    EndIf

    // Mapeia dinamicamente os campos retornados pela query executada
    For nI := 1 To (cAliasRes)->(FCount())
        AAdd(aFields, (cAliasRes)->(FieldName(nI)))
    Next nI

    // -------------------------------------------------------------------------
    // PAGINAÇÃO EM MEMÓRIA (Evita estouro de AppServer e timeout no Cloudflare)
    // -------------------------------------------------------------------------
    While !(cAliasRes)->(Eof())
        nCurrRow++
        
        // Verifica se o registro atual pertence à página solicitada pelo backend
        If nCurrRow >= nStartRow .And. nCurrRow <= nEndRow
            oRow := JsonObject():New()
            
            For nI := 1 To Len(aFields)
                cField := aFields[nI]
                xVal   := (cAliasRes)->(&(cField))
                
                // Sanitização e tratamento de Encodings de caracteres (Essencial para a IA)
                If ValType(xVal) == "C"
                    xVal := AllTrim(EncodeUTF8(xVal))
                EndIf
                
                oRow[cField] := xVal
            Next nI
            
            AAdd(aData, oRow)
        EndIf
        
        (cAliasRes)->(DbSkip())
    EndDo

    // Fecha a área de memória imediatamente (Boas práticas de performance)
    (cAliasRes)->(CloseArea())

    // -------------------------------------------------------------------------
    // RETORNO ESTRUTURADO PARA O BACKEND (HETZNER)
    // -------------------------------------------------------------------------
    oJsonResult["totalRecords"] := nCurrRow
    oJsonResult["page"]         := nPage
    oJsonResult["pageSize"]     := nPageSize
    oJsonResult["items"]        := aData

    Self:SetResponse(oJsonResult:ToJson())
Return lRet
