const fetch = require('jest-fetch-mock');
jest.setMock('node-fetch', fetch);

const { makeExecutableSchema } = require('graphql-tools');
const { ApolloServer, gql } = require('apollo-server');
const { createTestClient } = require('apollo-server-testing');

const resolveAeConfiguration = require('../index');

const QueryTypeDefs = gql`
# the schema allows the following query:
type Query {
  historics: [Historic]
  historic(id: Int!): Historic
  findHistoricByDocumentStatus(documentStatus_eq: String!): [Historic]
  find(documentStatus_eq: String!, and_userId_eq: String): [Historic]
  find2(documentStatus: String!): [Historic]
  find3(documentStatus_eq: String!, and_userId_not_eq: String): [Historic]
  find4(and_not_documentStatus_eq_r: String!): [Historic]
  find5(quarentineValidationId_eq: Int!): [Historic]
}
`;

const typeDefsTest = gql`
  type QuarentineValidation {
    id: Int!
    documentType: String
    document: String
    companyKey: String
    createDate: String
    deleted: Boolean
  }
  type Historic {
    id: Int!
    validationStatus: String
    documentStatus: String
    correlationId: String
    createDate: String
    quarentineValidationId: Int
    userId: String
    quarentineValidation: QuarentineValidation
  }
`;

const dependencies = [{
  typeDefs: typeDefsTest, 
  url: `http://localhost/v1/QuarantineHistory`,
  nodes: ["historic", "historics", "findHistoricByDocumentStatus", "find", "find2", "find3", "find4", "find5"]
}];
const resolveAe = resolveAeConfiguration(dependencies);
const resolvers = {
  Query: {
    historics: resolveAe,
    historic: resolveAe,
    findHistoricByDocumentStatus: resolveAe,
    find: resolveAe,
    find2: resolveAe,
    find3: resolveAe,
    find4: resolveAe,
    find5: resolveAe,
  }
}
dependencies.filter(x => x.Resolvers).map(x => resolvers[x.Resolvers.Name] = x.Resolvers.Resolver)

const typeDefs = [QueryTypeDefs, ...dependencies.map(x => x.typeDefs)]
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
const context =  (ctx) => { 
  ctx ={}
  ctx["req"] ={ headers: [{"X-Correlation-ID":"123"}] }
  return ctx; 
};
const server = new ApolloServer({ schema, context });
const { query } = createTestClient(server);

beforeAll(async () => {
  fetch.mockImplementation(async () => await Promise.resolve({
    ok: true,
    status: 200,
    json: () => {
      return _result
    }
  }));
})

describe('Validação do resolver', () => {
  it('valida os throws', async () => {
    await expect(resolveAe(null, null, context(), null)).rejects.toThrow();
    await expect(resolveAe(null, null, context(), {})).rejects.toThrow();
  });

  it('valida consulta com mais de um nivel(expand)', async () => {
    const res = await resolveAe(null, {}, context(), info);
    expect(res[0].id).toEqual(1);
  })

  it('Lista o historico', async () => {
    const res = await query({
      query: `{ 
        historics { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.data.historics[0].id).toEqual(1);
  })

  it('busca do status do documento', async () => {
    const res = await query({
      query: `{ 
        findHistoricByDocumentStatus(documentStatus_eq: "Regular") { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.data.findHistoricByDocumentStatus[0].id).toEqual(1);
  })

  it('Busca com $filter e clausura AND e Igual', async () => {
    const res = await query({
      query: `{ 
        find(documentStatus_eq: "Regular", and_userId_eq: "00000000-0000-0000-0000-000000000000") { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.data.find[0].id).toEqual(1);
  })

  it('Busca com $filter e subtendido Igual', async () => {
    const res = await query({
      query: `{ 
        find2(documentStatus: "Regular") { 
          id
          quarentineValidation {
            id
          }
        }
    }`})
    expect(res.data.find2[0].id).toEqual(1);
  })


  it('Busca com $filter e clausula AND e Nao Igual', async () => {
    const res = await query({
      query: `{ 
        find3(documentStatus_eq: "Regular", and_userId_not_eq: "00000000-0000-0000-0000-000000000000") { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.data.find3[0].id).toEqual(1);
  })

  it('Busca com falha', async () => {
    const res = await query({
      query: `{ 
        find4(and_not_documentStatus_eq_r: "Regular") { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.data.find4[0].id).toEqual(1);
  })

  it('Busca com retorno de erro', async () => {
    const res = await query({
      query: `{ 
        find5(quarentineValidationId_eq: 1) { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.data.find5[0].id).toEqual(1);
  })

  it('Valida resposta com erro do OData', async () => {
    fetch.mockImplementation(async () => await Promise.resolve({
      ok: false,
      status: 400,
      json: () => {
        return _resultError
      }
    }));

    const res = await query({
      query: `{ 
        find5(quarentineValidationId_eq: 1) { 
          id
          quarentineValidation {
            id
          }
        }   
    }`})
    expect(res.errors[0].name).toEqual("GraphQLError");
  })

});

const info = { "fieldName": "historics", "fieldNodes": [{ "kind": "Field", "name": { "kind": "Name", "value": "historics", "loc": { "start": 4, "end": 13 } }, "arguments": [], "directives": [], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id", "loc": { "start": 20, "end": 22 } }, "arguments": [], "directives": [], "loc": { "start": 20, "end": 22 } }, { "kind": "Field", "name": { "kind": "Name", "value": "quarentineValidation", "loc": { "start": 27, "end": 47 } }, "arguments": [], "directives": [], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id", "loc": { "start": 56, "end": 58 } }, "arguments": [], "directives": [], "loc": { "start": 56, "end": 58 } }, { "kind": "Field", "name": { "kind": "Name", "value": "document", "loc": { "start": 65, "end": 73 } }, "arguments": [], "directives": [], "loc": { "start": 65, "end": 73 } }], "loc": { "start": 48, "end": 79 } }, "loc": { "start": 27, "end": 79 } }], "loc": { "start": 14, "end": 83 } }, "loc": { "start": 4, "end": 83 } }], "returnType": "[Historic]", "parentType": "Query", "path": { "key": "historics" }, "schema": { "__validationErrors": [], "__allowedLegacyNames": [], "_queryType": "Query", "_directives": ["@skip", "@include", "@deprecated"], "_typeMap": { "Query": "Query", "Historic": "Historic", "Int": "Int", "String": "String", "QuarentineValidation": "QuarentineValidation", "Boolean": "Boolean", "Customer": "Customer", "Self": "Self", "MetaData": "MetaData", "Phone": "Phone", "Address": "Address", "__Schema": "__Schema", "__Type": "__Type", "__TypeKind": "__TypeKind", "__Field": "__Field", "__InputValue": "__InputValue", "__EnumValue": "__EnumValue", "__Directive": "__Directive", "__DirectiveLocation": "__DirectiveLocation" }, "_possibleTypeMap": {}, "_implementations": {}, "_extensionsEnabled": true }, "fragments": {}, "operation": { "kind": "OperationDefinition", "operation": "query", "variableDefinitions": [], "directives": [], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "historics", "loc": { "start": 4, "end": 13 } }, "arguments": [], "directives": [], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id", "loc": { "start": 20, "end": 22 } }, "arguments": [], "directives": [], "loc": { "start": 20, "end": 22 } }, { "kind": "Field", "name": { "kind": "Name", "value": "quarentineValidation", "loc": { "start": 27, "end": 47 } }, "arguments": [], "directives": [], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id", "loc": { "start": 56, "end": 58 } }, "arguments": [], "directives": [], "loc": { "start": 56, "end": 58 } }, { "kind": "Field", "name": { "kind": "Name", "value": "document", "loc": { "start": 65, "end": 73 } }, "arguments": [], "directives": [], "loc": { "start": 65, "end": 73 } }], "loc": { "start": 48, "end": 79 } }, "loc": { "start": 27, "end": 79 } }], "loc": { "start": 14, "end": 83 } }, "loc": { "start": 4, "end": 83 } }], "loc": { "start": 0, "end": 85 } }, "loc": { "start": 0, "end": 85 } }, "variableValues": {}, "cacheControl": { "cacheHint": { "maxAge": 0 } } };
const _result = {
  "@odata.context": "http://prdva-core-quarantine-76bac1b390fcfb7f.elb.us-east-1.amazonaws.com:5004/v1/$metadata#QuarantineHistory(id,validationStatus,documentStatus,correlationId,createDate,quarentineValidationId,userId,quarentineValidation(documentType,document,companyKey,createDate,deleted))",
  "value": [
    {
      "id": 1,
      "validationStatus": "Refused",
      "documentStatus": "Regular",
      "correlationId": "",
      "createDate": "2019-04-29T15:08:26.445027-03:00",
      "quarentineValidationId": 1,
      "userId": "00000000-0000-0000-0000-000000000000",
      "quarentineValidation": {
        "documentType": "Cpf",
        "document": "38400344855",
        "companyKey": "e",
        "createDate": "2019-04-29T15:07:36-03:00",
        "deleted": false
      }
    },
    {
      "id": 2,
      "validationStatus": "Refused",
      "documentStatus": "Regular",
      "correlationId": "",
      "createDate": "2019-05-10T18:25:28.838155-03:00",
      "quarentineValidationId": 1,
      "userId": "00000000-0000-0000-0000-000000000000",
      "quarentineValidation": {
        "documentType": "Cpf",
        "document": "38400344855",
        "companyKey": "e",
        "createDate": "2019-04-29T15:07:36-03:00",
        "deleted": false
      }
    }
  ]
}

const _resultError = {
  "error": {
      "code": "",
      "message": "The query specified in the URI is not valid. Could not find a property named 'validationStatus3' on type 'Core.Quarantine.Models.Data.QuarantineHistory'.",
      "details": [],
      "innererror": {
          "message": "Could not find a property named 'validationStatus3' on type 'Core.Quarantine.Models.Data.QuarantineHistory'.",
          "type": "Microsoft.OData.ODataException",
          "stacktrace": "   at Microsoft.OData.UriParser.SelectPathSegmentTokenBinder.ConvertNonTypeTokenToSegment(PathSegmentToken tokenIn, IEdmModel model, IEdmStructuredType edmType, ODataUriResolver resolver)\n   at Microsoft.OData.UriParser.SelectPropertyVisitor.ProcessTokenAsPath(NonSystemToken tokenIn)\n   at Microsoft.OData.UriParser.SelectPropertyVisitor.Visit(NonSystemToken tokenIn)\n   at Microsoft.OData.UriParser.SelectBinder.Bind(SelectToken tokenIn)\n   at Microsoft.OData.UriParser.SelectExpandBinder.Bind(ExpandToken tokenIn)\n   at Microsoft.OData.UriParser.SelectExpandSemanticBinder.Bind(ODataPathInfo odataPathInfo, ExpandToken expandToken, SelectToken selectToken, ODataUriParserConfiguration configuration)\n   at Microsoft.OData.UriParser.ODataQueryOptionParser.ParseSelectAndExpandImplementation(String select, String expand, ODataUriParserConfiguration configuration, ODataPathInfo odataPathInfo)\n   at Microsoft.OData.UriParser.ODataQueryOptionParser.ParseSelectAndExpand()\n   at Microsoft.AspNet.OData.Query.Validators.SelectExpandQueryValidator.Validate(SelectExpandQueryOption selectExpandQueryOption, ODataValidationSettings validationSettings)\n   at Microsoft.AspNet.OData.Query.Validators.ODataQueryValidator.Validate(ODataQueryOptions options, ODataValidationSettings validationSettings)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.ValidateQuery(HttpRequest request, ODataQueryOptions queryOptions)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.<>c__DisplayClass1_0.<OnActionExecuted>b__3(ODataQueryContext queryContext)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.ExecuteQuery(Object responseValue, IQueryable singleResultCollection, IWebApiActionDescriptor actionDescriptor, Func`2 modelFunction, IWebApiRequestMessage request, Func`2 createQueryOptionFunction)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.OnActionExecuted(Object responseValue, IQueryable singleResultCollection, IWebApiActionDescriptor actionDescriptor, IWebApiRequestMessage request, Func`2 modelFunction, Func`2 createQueryOptionFunction, Action`1 createResponseAction, Action`3 createErrorAction)"
      }
  }
}