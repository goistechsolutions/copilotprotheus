# Base de Conhecimento: Protheus e Integrações REST (TLPP e ADVPL)

Este documento consolida os princípios de arquitetura do ERP Protheus e o desenvolvimento de APIs REST, servindo como base técnica essencial para as implementações do assistente CopilotProtheus.

## 1. Módulos e Estrutura Organizacional do Protheus
O Protheus é um ERP modular altamente configurável, com módulos fundamentais para: **Compras**, **Estoque/Custos**, **Faturamento**, **Financeiro**, **Fiscal**, **PCP (Manufatura)** e **Varejo**. 

### Conceito de Empresas e Filiais (SM0)
Existem duas formas principais de organizar as entidades no sistema:
1. **Conceito Empresa/Filial (Clássico):** Modelo direto. Um Grupo de Empresas contendo Filiais. Compartilhamento de tabelas configurado entre filiais do mesmo grupo. O código da filial costuma ter 2 dígitos (Ex: `01`).
2. **Gestão de Empresas:** Focado em maior escalabilidade. Hierarquia completa: **Grupo de Empresas** -> **Empresa** (CNPJ distinto) -> **Unidade de Negócios** -> **Filial**. O código da filial gravado no banco de dados (campo `M0_CODFIL`) concatena os identificadores dessa hierarquia, totalizando até 6 dígitos conforme o *Leiaute* (Ex: `EEUUFF`).

---

## 2. Configuração do Servidor REST (`appserver.ini`)
Para que o Protheus responda requisições HTTP, o arquivo `appserver.ini` deve ser configurado com o protocolo e os Sockets/URIs de escuta.

```ini
[HTTPV11]
Enable=1
Sockets=HTTPREST

[HTTPREST]
Port=8080
URIs=HTTPURI
SECURITY=1

[HTTPURI]
URL=/rest/
PrepareIn=All
Stateless=1 ; Ativa o consumo de licenças por demanda
Instances=1,2
```
- **`PREPAREIN`**: Define quais grupos de empresas terão *threads* preparadas para receber requisições. O cliente escolhe a filial exata e o ambiente enviando no cabeçalho HTTP a chave `tenantid: 19,D MG 02`. Também suporta o header `x-erp-module` (ex: `FIN`, `FAT`).
- **Licenças por Demanda (`Stateless=1`)**: A API não retém uma licença permanentemente. A licença só é requisitada (`REST_START`) no momento exato em que a API é acionada, sendo devolvida ao término. Se todas as licenças do servidor estiverem em uso, o serviço devolve o erro **503**.

---

## 3. Desenvolvimento de APIs em REST TLPP
O REST TLPP roda de forma nativa no AppServer, oferecendo alta performance. As requisições possuem isolamento por thread e interagem com o cliente por meio do objeto automático `oRest`.
**Includes Obrigatórios:** `#include "tlpp-core.th"` e `#include "tlpp-rest.th"`.

### 3.1 Roteamento via Annotations
As rotas são declaradas diretamente no código-fonte usando Annotations (`@Get`, `@Post`, `@Put`, `@Delete`).

```tlpp
#include "tlpp-core.th"
#include "tlpp-rest.th"

@Get("api/v1/clientes/:id")
User Function getCliente()
    Local jParams := oRest:getPathParamsRequest()
    Local cId := jParams["id"]
    
    // ...
    oRest:setStatusResponse(200)
    oRest:setResponse('{"id": "' + cId + '", "nome": "Cliente"}')
Return .T.
```
### 3.2 O Objeto `oRest`
Injetado automaticamente, nunca instanciado com `New()`.
- **Entrada:** `oRest:getPathParamsRequest()`, `oRest:getQueryRequest()`, `oRest:GetBodyRequest()`.
- **Saída:** `oRest:setStatusResponse(200)`, `oRest:setResponse(cJson)`.

### 3.3 Doc Generate e OpenAPI (Metadados TLPP)
O `tlppCore` possui um motor nativo chamado **REST-DOC**, que extrai metadados do seu código e gera a documentação no padrão OpenAPI (Swagger). A função `tlpp.doc.generate( 'swagger', 'api_doc' )` exporta essa especificação para um arquivo `.yaml` ou `.json`. A forma recomendada de documentar APIs reais é através de uma **Função Dedicada `_DOC`**, que isola os metadados JSON ricos da lógica de execução da API.

---

## 4. Integrações REST em ADVPL Clássico
Além do moderno motor TLPP, o Protheus possui amplo suporte para trabalhar com REST no modelo clássico ADVPL, utilizando classes nativas de integração.

### 4.1 Criando APIs no Protheus (Servidor REST)
Utiliza-se os comandos estruturais do `wsrestful.ch`:
```advpl
#include "protheus.ch"
#include "wsrestful.ch"

WSRESTFUL CLIENTES DESCRIPTION "API de Clientes"
    WSMETHOD GET DESCRIPTION "Retorna dados" PATH "/clientes/:codigo" PRODUCES "application/json"
ENDWSRESTFUL

WSFUNCTION GET() AS LOGICAL
    Local cCodigo := ::GetPathParam("codigo")
    Local oRet := JsonObject():New()
    
    oRet["codigo"] := cCodigo
    oRet["nome"]   := "Cliente Teste"
    
    ::SetResponse(oRet:ToJson())
    ::SetStatusCode(200)
Return .T.
```

### 4.2 Consumindo APIs Externas (Cliente REST)
Para o Protheus atuar de forma ativa consumindo sistemas de terceiros (ex: ViaCEP), a classe utilizada é a `FWRest`:
```advpl
#include "fwrest.ch"

User Function getCepExemplo()
    Local oRest := FWRest():New("https://viacep.com.br/ws/01001000/json/")
    Local oJson

    If oRest:Get()
        oJson := JsonObject():New()
        oJson:FromJson(oRest:GetResult())
        ConOut("Bairro Encontrado: " + oJson["bairro"])
    Else
        ConOut("Falha na requisicao: " + oRest:GetResult())
    EndIf
Return
```
