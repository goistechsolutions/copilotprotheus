#Include 'Protheus.ch'
#Include 'FWMVCDEF.ch'
#Include 'RestFul.CH'

User Function QRYREST()
Return

WSRESTFUL QueryRest DESCRIPTION "Generic Query Execution API"
  WSDATA cQuery AS STRING
  WSMETHOD GET DESCRIPTION "Execute a SELECT query via URL parameter and return results as JSON"
  WSMETHOD POST DESCRIPTION "Execute a SELECT query via POST body and return results as JSON"
END WSRESTFUL

WSMETHOD GET WSRECEIVE cQuery WSSERVICE QueryRest
  Local aRet      := {}
  Local aStruct   := {}
  Local cAlias    := GetNextAlias()
  Local nX        := 0
  Local cCleanQry := Self:cQuery
  Local aArea     := GetArea()
  Local oErr
  Local lRet      := .T.

  ::SetContentType("application/json")

  If Empty(cCleanQry)
    oErr := JsonObject():New()
    oErr["error"] := "query parameter is required"
    ::SetResponse(oErr:ToJson())
    SetRestFault(400, "query parameter is required")
    RestArea(aArea)
    Return .F.
  EndIf

  // Validacao: Somente queries SELECT sao permitidas
  If !(Upper(Left(AllTrim(cCleanQry), 6)) == "SELECT")
    oErr := JsonObject():New()
    oErr["error"] := "Only SELECT queries are allowed"
    ::SetResponse(oErr:ToJson())
    SetRestFault(403, "Only SELECT queries are allowed")
    RestArea(aArea)
    Return .F.
  EndIf

  dbUseArea(.T., "TOPCONN", TCGenQry(,, cCleanQry), cAlias, .F., .T.)

  If Select(cAlias) > 0
    aStruct := (cAlias)->(dbStruct())
    
    Do While !(cAlias)->(EoF())
      Local oRow := JsonObject():New()
      For nX := 1 To Len(aStruct)
        Local cFieldName := aStruct[nX, 1]
        Local cFieldType := aStruct[nX, 2]
        Local xValue := (cAlias)->&(cFieldName)
        
        If cFieldType == "C"
          oRow[cFieldName] := AllTrim(xValue)
        ElseIf cFieldType == "N"
          oRow[cFieldName] := xValue
        ElseIf cFieldType == "D"
          oRow[cFieldName] := DToC(xValue)
        ElseIf cFieldType == "L"
          oRow[cFieldName] := xValue
        EndIf
      Next
      
      aAdd(aRet, oRow)
      (cAlias)->(DbSkip())
    EndDo
    
    (cAlias)->(DbCloseArea())
  EndIf

  ::SetResponse(FWJsonSerialize(aRet))

  RestArea(aArea)
Return(lRet)

WSMETHOD POST WSRECEIVE cQuery WSSERVICE QueryRest
  Local aRet      := {}
  Local aStruct   := {}
  Local cAlias    := GetNextAlias()
  Local cCleanQry := ""
  Local nX        := 0
  Local oJsonObject
  Local cErro     := ""
  Local aArea     := GetArea()
  Local oErr
  Local lRet      := .T.

  ::SetContentType("application/json")

  // Parse do corpo JSON
  Local cBody := Self:GetContent()
  If !Empty(cBody)
    oJsonObject := JsonObject():New()
    cErro := oJsonObject:fromJson(cBody)
    If Empty(cErro) .And. oJsonObject:hasProperty("query")
      cCleanQry := oJsonObject:GetJSProperty("query")
    EndIf
  EndIf

  If Empty(cCleanQry)
    cCleanQry := Self:cQuery
  EndIf

  If Empty(cCleanQry)
    oErr := JsonObject():New()
    oErr["error"] := "query parameter or body is required"
    ::SetResponse(oErr:ToJson())
    SetRestFault(400, "query parameter or body is required")
    RestArea(aArea)
    Return .F.
  EndIf

  // Validacao: Somente queries SELECT sao permitidas
  If !(Upper(Left(AllTrim(cCleanQry), 6)) == "SELECT")
    oErr := JsonObject():New()
    oErr["error"] := "Only SELECT queries are allowed"
    ::SetResponse(oErr:ToJson())
    SetRestFault(403, "Only SELECT queries are allowed")
    RestArea(aArea)
    Return .F.
  EndIf

  dbUseArea(.T., "TOPCONN", TCGenQry(,, cCleanQry), cAlias, .F., .T.)

  If Select(cAlias) > 0
    aStruct := (cAlias)->(dbStruct())
    
    Do While !(cAlias)->(EoF())
      Local oRow := JsonObject():New()
      For nX := 1 To Len(aStruct)
        Local cFieldName := aStruct[nX, 1]
        Local cFieldType := aStruct[nX, 2]
        Local xValue := (cAlias)->&(cFieldName)
        
        If cFieldType == "C"
          oRow[cFieldName] := AllTrim(xValue)
        ElseIf cFieldType == "N"
          oRow[cFieldName] := xValue
        ElseIf cFieldType == "D"
          oRow[cFieldName] := DToC(xValue)
        ElseIf cFieldType == "L"
          oRow[cFieldName] := xValue
        EndIf
      Next
      
      aAdd(aRet, oRow)
      (cAlias)->(DbSkip())
    EndDo
    
    (cAlias)->(DbCloseArea())
  EndIf

  ::SetResponse(FWJsonSerialize(aRet))

  RestArea(aArea)
Return(lRet)
