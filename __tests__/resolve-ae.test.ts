import { ApolloServer, gql } from 'apollo-server';
import { createTestClient } from 'apollo-server-testing';
import { makeExecutableSchema } from 'graphql-tools';

import { ApolloODataResolver } from '../src';
import { ODataResolver, Resolvers } from '../src/data-struct';

import { Fetch, RequestOptions } from '../src/fetch-ts/Fetch';
import { GraphQLResponse } from 'graphql-extensions';

describe('Validação do resolver', () => {
  it('Valida resposta com erro do OData', async () => {
    const response: GraphQLResponse = await query({
      query: `{
        find5(quarentineValidationId_eq: 1) {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });

    const text = response.errors![0].message;
    expect(text).toBe('Cannot return null for non-nullable field QuarentineValidation.id.');
  });

  it('valida os throws', async () => {
    await expect(apolloODataResolver.resolverODataAndCall(null, null, context(null), null)).rejects.toThrow();
    await expect(apolloODataResolver.resolverODataAndCall(null, null, context(null), {})).rejects.toThrow();
  });

  it('valida consulta com mais de um nivel(expand)', async () => {
    const res = await apolloODataResolver.resolverODataAndCall(null, {}, context(null), info);
    expect(res[0].id).toEqual(1);
  });

  it('Lista o historico', async () => {
    const res = await query({
      query: `{
        historics {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.historics[0].id).toEqual(1);
  });

  it('Busca por id', async () => {
    const res = await query({
      query: `{
        historic(id: 1) {
          id
          self
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.historic.id).toEqual(1);
  });

  it('busca do status do documento', async () => {
    const res = await query({
      query: `{
        findHistoricByDocumentStatus(documentStatus_eq: "Regular") {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.findHistoricByDocumentStatus[0].id).toEqual(1);
  });

  it('Busca com $filter e clausura AND e Igual', async () => {
    const res = await query({
      query: `{
        find(documentStatus_eq: "Regular", and_userId_eq: "00000000-0000-0000-0000-000000000000") {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.find[0].id).toEqual(1);
  });

  it('Busca com $filter e subtendido Igual', async () => {
    const res = await query({
      query: `{
        find2(documentStatus: "Regular") {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.find2[0].id).toEqual(1);
  });

  it('Busca com $filter e clausula AND e Nao Igual', async () => {
    const res = await query({
      query: `{
        find3(documentStatus_eq: "Regular", and_userId_not_eq: "00000000-0000-0000-0000-000000000000") {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.find3[0].id).toEqual(1);
  });

  it('Busca com falha', async () => {
    const res = await query({
      query: `{
        find4(and_not_documentStatus_eq_r: "Regular") {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.find4[0].id).toEqual(1);
  });

  it('Busca com retorno de erro', async () => {
    const res = await query({
      query: `{
        find5(quarentineValidationId_eq: 1) {
          id
          quarentineValidation {
            id
          }
        }
    }`,
    });
    expect(res.data!.find5[0].id).toEqual(1);
  });
});

class TestODataResolver implements ODataResolver {
  constructor(public nodes: string[], public excludeFromOData: string[], public url: string, public typeDefs: import('graphql').DocumentNode, public resolvers: Resolvers) {}
}

class FetchMock implements Fetch {
  Call(url: string, init?: RequestOptions): any {
    const resultJson = url.toString().includes('(1)') ? _singleResult : _result;
    return resultJson;
  }
}

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
    self: String
  }
`;

const dependencies: ODataResolver[] = [
  new TestODataResolver(
    ['historic', 'historics', 'findHistoricByDocumentStatus', 'find', 'find2', 'find3', 'find4', 'find5'],
    ['self'],
    `http://localhost/v1/QuarantineHistory`,
    typeDefsTest,
    (null as unknown) as Resolvers
  ),
];
dependencies
  .filter(x => x.resolvers !== null)
  .forEach(x => {
    x.resolvers.querys.forEach(m => {
      if (!resolvers[x.resolvers.name]) {
        resolvers[x.resolvers.name] = {};
      }
      resolvers[x.resolvers.name][m.name] = m.func;
    });
  });

const apolloODataResolver = new ApolloODataResolver(dependencies, new FetchMock());
const resolverfunc = apolloODataResolver.resolverODataAndCall.bind(apolloODataResolver);
const resolvers: any = {
  Query: {
    historics: resolverfunc,
    historic: resolverfunc,
    findHistoricByDocumentStatus: resolverfunc,
    find: resolverfunc,
    find2: resolverfunc,
    find3: resolverfunc,
    find4: resolverfunc,
    find5: resolverfunc,
  },
};

const context = (ctx: any) => {
  ctx = {};
  ctx.req = { headers: [{ 'X-Correlation-ID': '123' }] };
  return ctx;
};

const queryTypeDefs = gql`
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

const typeDefs = [queryTypeDefs, ...dependencies.map(x => x.typeDefs)];
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
const server = new ApolloServer({ schema, context });
const { query } = createTestClient(server);
const info = {
  fieldName: 'historics',
  fieldNodes: [
    {
      kind: 'Field',
      name: { kind: 'Name', value: 'historics', loc: { start: 4, end: 13 } },
      arguments: [],
      directives: [],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'id', loc: { start: 20, end: 22 } },
            arguments: [],
            directives: [],
            loc: { start: 20, end: 22 },
          },
          {
            kind: 'Field',
            name: {
              kind: 'Name',
              value: 'quarentineValidation',
              loc: { start: 27, end: 47 },
            },
            arguments: [],
            directives: [],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {
                    kind: 'Name',
                    value: 'id',
                    loc: { start: 56, end: 58 },
                  },
                  arguments: [],
                  directives: [],
                  loc: { start: 56, end: 58 },
                },
                {
                  kind: 'Field',
                  name: {
                    kind: 'Name',
                    value: 'document',
                    loc: { start: 65, end: 73 },
                  },
                  arguments: [],
                  directives: [],
                  loc: { start: 65, end: 73 },
                },
              ],
              loc: { start: 48, end: 79 },
            },
            loc: { start: 27, end: 79 },
          },
        ],
        loc: { start: 14, end: 83 },
      },
      loc: { start: 4, end: 83 },
    },
  ],
  returnType: '[Historic]',
  parentType: 'Query',
  path: { key: 'historics' },
  schema: {
    __validationErrors: [],
    __allowedLegacyNames: [],
    _queryType: 'Query',
    _directives: ['@skip', '@include', '@deprecated'],
    _typeMap: {
      Query: 'Query',
      Historic: 'Historic',
      Int: 'Int',
      String: 'String',
      QuarentineValidation: 'QuarentineValidation',
      Boolean: 'Boolean',
      Customer: 'Customer',
      Self: 'Self',
      MetaData: 'MetaData',
      Phone: 'Phone',
      Address: 'Address',
      __Schema: '__Schema',
      __Type: '__Type',
      __TypeKind: '__TypeKind',
      __Field: '__Field',
      __InputValue: '__InputValue',
      __EnumValue: '__EnumValue',
      __Directive: '__Directive',
      __DirectiveLocation: '__DirectiveLocation',
    },
    _possibleTypeMap: {},
    _implementations: {},
    _extensionsEnabled: true,
  },
  fragments: {},
  operation: {
    kind: 'OperationDefinition',
    operation: 'query',
    variableDefinitions: [],
    directives: [],
    selectionSet: {
      kind: 'SelectionSet',
      selections: [
        {
          kind: 'Field',
          name: {
            kind: 'Name',
            value: 'historics',
            loc: { start: 4, end: 13 },
          },
          arguments: [],
          directives: [],
          selectionSet: {
            kind: 'SelectionSet',
            selections: [
              {
                kind: 'Field',
                name: {
                  kind: 'Name',
                  value: 'id',
                  loc: { start: 20, end: 22 },
                },
                arguments: [],
                directives: [],
                loc: { start: 20, end: 22 },
              },
              {
                kind: 'Field',
                name: {
                  kind: 'Name',
                  value: 'quarentineValidation',
                  loc: { start: 27, end: 47 },
                },
                arguments: [],
                directives: [],
                selectionSet: {
                  kind: 'SelectionSet',
                  selections: [
                    {
                      kind: 'Field',
                      name: {
                        kind: 'Name',
                        value: 'id',
                        loc: { start: 56, end: 58 },
                      },
                      arguments: [],
                      directives: [],
                      loc: { start: 56, end: 58 },
                    },
                    {
                      kind: 'Field',
                      name: {
                        kind: 'Name',
                        value: 'document',
                        loc: { start: 65, end: 73 },
                      },
                      arguments: [],
                      directives: [],
                      loc: { start: 65, end: 73 },
                    },
                  ],
                  loc: { start: 48, end: 79 },
                },
                loc: { start: 27, end: 79 },
              },
            ],
            loc: { start: 14, end: 83 },
          },
          loc: { start: 4, end: 83 },
        },
      ],
      loc: { start: 0, end: 85 },
    },
    loc: { start: 0, end: 85 },
  },
  variableValues: {},
  cacheControl: { cacheHint: { maxAge: 0 } },
};

const _result = {
  '@odata.context':
    'http://prdva-core-quarantine-76bac1b390fcfb7f.elb.us-east-1.amazonaws.com:5004/v1/$metadata#QuarantineHistory(id,validationStatus,documentStatus,correlationId,createDate,quarentineValidationId,userId,quarentineValidation(documentType,document,companyKey,createDate,deleted))',
  value: [
    {
      id: 1,
      validationStatus: 'Refused',
      documentStatus: 'Regular',
      correlationId: '',
      createDate: '2019-04-29T15:08:26.445027-03:00',
      quarentineValidationId: 1,
      userId: '00000000-0000-0000-0000-000000000000',
      quarentineValidation: {
        documentType: 'Cpf',
        document: '38400344855',
        companyKey: 'e',
        createDate: '2019-04-29T15:07:36-03:00',
        deleted: false,
      },
    },
    {
      id: 2,
      validationStatus: 'Refused',
      documentStatus: 'Regular',
      correlationId: '',
      createDate: '2019-05-10T18:25:28.838155-03:00',
      quarentineValidationId: 1,
      userId: '00000000-0000-0000-0000-000000000000',
      quarentineValidation: {
        documentType: 'Cpf',
        document: '38400344855',
        companyKey: 'e',
        createDate: '2019-04-29T15:07:36-03:00',
        deleted: false,
      },
    },
  ],
};

const _singleResult = {
  '@odata.context':
    'http://prdva-core-quarantine-76bac1b390fcfb7f.elb.us-east-1.amazonaws.com:5004/v1/$metadata#QuarantineHistory(id,validationStatus,documentStatus,correlationId,createDate,quarentineValidationId,userId,quarentineValidation(documentType,document,companyKey,createDate,deleted))',
  id: 1,
  validationStatus: 'Refused',
  documentStatus: 'Regular',
  correlationId: '',
  createDate: '2019-04-29T15:08:26.445027-03:00',
  quarentineValidationId: 1,
  userId: '00000000-0000-0000-0000-000000000000',
  quarentineValidation: {
    documentType: 'Cpf',
    document: '38400344855',
    companyKey: 'e',
    createDate: '2019-04-29T15:07:36-03:00',
    deleted: false,
  },
};
const _resultError = {
  error: {
    code: '',
    message: "The query specified in the URI is not valid. Could not find a property named 'validationStatus3' on type 'Core.Quarantine.Models.Data.QuarantineHistory'.",
    details: [],
    innererror: {
      message: "Could not find a property named 'validationStatus3' on type 'Core.Quarantine.Models.Data.QuarantineHistory'.",
      type: 'Microsoft.OData.ODataException',
      stacktrace:
        '   at Microsoft.OData.UriParser.SelectPathSegmentTokenBinder.ConvertNonTypeTokenToSegment(PathSegmentToken tokenIn, IEdmModel model, IEdmStructuredType edmType, ODataUriResolver resolver)\n   at Microsoft.OData.UriParser.SelectPropertyVisitor.ProcessTokenAsPath(NonSystemToken tokenIn)\n   at Microsoft.OData.UriParser.SelectPropertyVisitor.Visit(NonSystemToken tokenIn)\n   at Microsoft.OData.UriParser.SelectBinder.Bind(SelectToken tokenIn)\n   at Microsoft.OData.UriParser.SelectExpandBinder.Bind(ExpandToken tokenIn)\n   at Microsoft.OData.UriParser.SelectExpandSemanticBinder.Bind(ODataPathInfo odataPathInfo, ExpandToken expandToken, SelectToken selectToken, ODataUriParserConfiguration configuration)\n   at Microsoft.OData.UriParser.ODataQueryOptionParser.ParseSelectAndExpandImplementation(String select, String expand, ODataUriParserConfiguration configuration, ODataPathInfo odataPathInfo)\n   at Microsoft.OData.UriParser.ODataQueryOptionParser.ParseSelectAndExpand()\n   at Microsoft.AspNet.OData.Query.Validators.SelectExpandQueryValidator.Validate(SelectExpandQueryOption selectExpandQueryOption, ODataValidationSettings validationSettings)\n   at Microsoft.AspNet.OData.Query.Validators.ODataQueryValidator.Validate(ODataQueryOptions options, ODataValidationSettings validationSettings)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.ValidateQuery(HttpRequest request, ODataQueryOptions queryOptions)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.<>c__DisplayClass1_0.<OnActionExecuted>b__3(ODataQueryContext queryContext)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.ExecuteQuery(Object responseValue, IQueryable singleResultCollection, IWebApiActionDescriptor actionDescriptor, Func`2 modelFunction, IWebApiRequestMessage request, Func`2 createQueryOptionFunction)\n   at Microsoft.AspNet.OData.EnableQueryAttribute.OnActionExecuted(Object responseValue, IQueryable singleResultCollection, IWebApiActionDescriptor actionDescriptor, IWebApiRequestMessage request, Func`2 modelFunction, Func`2 createQueryOptionFunction, Action`1 createResponseAction, Action`3 createErrorAction)',
    },
  },
};
