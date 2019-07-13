const fetch = require("node-fetch");
const { ApolloError } = require('apollo-server-errors');

const select = "$select=", expand = "$expand=", filter = "$filter=";
let list = [];

const resolverConfiguration = (listNodesAndUrl) => {
  list = list.concat(listNodesAndUrl);
  return resolveAe
}
let _parent = {};
async function resolveAe(parent, args, context, info) {
  _parent = parent;
  if (!info)
    throw new Error('Info is null');

  const node = list.find(x => x.nodes.some((item) => item == info.fieldName));
  if (!node)
    throw new Error(`Node not configuration for ${info.fieldName}`);

  return await _findBy(node, args, info, context);
}

/*
Eq	Equal	/Suppliers?$filter=Address/City eq 'Redmond'
Ne	Not equal	/Suppliers?$filter=Address/City ne 'London'
Gt	Greater than	/Products?$filter=Price gt 20
Ge	Greater than or equal	/Products?$filter=Price ge 10
Lt	Less than	/Products?$filter=Price lt 20
Le	Less than or equal	/Products?$filter=Price le 100
And	Logical and	/Products?$filter=Price le 200 and Price gt 3.5
Or	Logical or	/Products?$filter=Price le 3.5 or Price gt 200
Not Logical negation	/Products?$filter=not eq 'milk'
*/

const _findBy = async (node, args, info, context) => {
  let json = {};
  const resolved = resolverOData(info, node);
  const objectKeys = Object.keys(args);
  if (args["id"] && objectKeys.length == 1)
    json = await get(`${node.url}(${args["id"]})?${resolved}`, context);
  else if (!args["id"] && objectKeys.length > 0)
    json = await get(`${node.url}?${resolved}&${_resolverFilters(args, objectKeys)}`, context);
  else
    json = await get(`${node.url}?${resolved}`, context);
  return json.error ? json : (json.value ? json.value : json)
}

const _resolverFilters = (args, objectKeys) => {

  const queries = [];
  objectKeys.forEach(arg => {
    const item = args[arg];
    const value = typeof item === "string" ? `'${item}'` : item;

    const arr = arg.split(/_/g);
    switch (arr.length) {
      case 1:
        queries.push(`${arr[0]} eq ${value}`);
        break;
      case 2:
        queries.push(`${arr[0]} ${arr[1]} ${value}`);
        break;
      case 3:
        queries.push(`${arr[0]} ${arr[1]} ${arr[2]} ${value}`);
        break;
      case 4:
        queries.push(`${arr[0]} ${arr[1]} ${arr[2]} ${arr[3]} ${value}`);
        break;
      default:
        break;
    }
  });

  return queries.length > 0 ? `${filter}${queries.join(' ')}` : '';
}

const get = async (url, { req }) => {

  const res = await fetch(url, { method: 'GET', headers: req.headers }).Resolver();
  //const json = await res.json();
  return res;
}

const resolverOData = (info, node) => {
  const resolvido = rs(0, info.fieldNodes[0].selectionSet.selections, info.fieldNodes[0].name.value);
  return resolveQueryString(0, resolvido, node)
}

const resolveQueryString = (nivel, lista, node) => {
  const hasChildren = lista.some(x => x.children)

  if (!node.ExcludeFromOData)
    node.ExcludeFromOData = [];

  let uri = `${select}${lista.filter(x => !x.children).map(x => x.value).filter(x => !node.ExcludeFromOData.includes(x))}`
  if (hasChildren) {
    const hasChildrens = lista.filter(x => x.children);
    let hasExpand = false;
    for (let i = 0; i < hasChildrens.length; i++) {
      const element = hasChildrens[i];
      if (node.ExcludeFromOData.includes(element.value))
        continue;
      const concat = nivel > 0 ? ';' : '&';
      const child = `${hasExpand ? ',' : concat}${!hasExpand ? expand : ''}${element.value}(${resolveQueryString(nivel + 1, element.children, node)})`;
      hasExpand = true;
      uri += child
    }
  }
  return uri;
}

const rs = (nivel, listKind, parent) => {
  let arr = []
  for (let index = 0; index < listKind.length; index++) {
    const element = listKind[index];
    arr = arr.concat([{ nivel: nivel, value: element.name.value, parent: parent, children: !element.selectionSet ? null : rs(nivel + 1, element.selectionSet.selections, element.name.value) }]);
  }
  return arr;
}

Promise.prototype.Resolver = async function (parent = null) {
  if (!_parent) {
    let _parent = {}
    _parent = parent || _parent
    parent = _parent;
  }
  let resp = await this
  const d = Math.floor(resp.status / 100);
  switch (d) {
    case 2:
    case 3:
      return await resp.json();
    case 4:
    case 5:
    default: {
      let error = {};
      if (d === 4)
        error = await resp.json();

      let msg = null;
      if (error.error)
        msg = error.error.message
      throw new ApolloError(msg || `Unknown HTTP Status (${resp.status})`, resp.status, { parent, error, request: resp.url });
    }
  }
}

module.exports = resolverConfiguration


/*



const QueryTypeDefs = `
# the schema allows the following query:
scalar DateTime
type Query {
  historics: [Historic]
  historic(id: Int!): Historic
  customers: [Customer]
  customer(id: Int!): Customer
  findCustomerByDocument(cpf_eq: String): [Customer]
  ticket(id: Int!): Ticket
  ticketsByDocument(identificationDocument_eq: String!): [Ticket]
}

type Mutation {
  sendNote(ticketId: Int!, description: String, statusId: Int!): Note!
  updateCustomer(updateCustomer: UpdateCustomer!): Boolean!
}
input MetaFilter {
  # logical operators
  AND: [MetaFilter!] # combines all passed "MetaFilter" objects with logical AND
  OR: [MetaFilter!] # combines all passed "MetaFilter" objects with logical OR

  # DateTime filters
  createdAt: DateTime # matches all nodes with exact value
  createdAt_not: DateTime # matches all nodes with different value
  createdAt_in: [DateTime!] # matches all nodes with value in the passed list
  createdAt_not_in: [DateTime!] # matches all nodes with value not in the passed list
  createdAt_lt: DateTime # matches all nodes with lesser value
  createdAt_lte: DateTime # matches all nodes with lesser or equal value
  createdAt_gt: DateTime # matches all nodes with greater value
  createdAt_gte: DateTime # matches all nodes with greater or equal value

  # Float filters
  decimal: Float # matches all nodes with exact value
  decimal_not: Float # matches all nodes with different value
  decimal_in: [Float!] # matches all nodes with value in the passed list
  decimal_not_in: [Float!] # matches all nodes with value not in the passed list
  decimal_lt: Float # matches all nodes with lesser value
  decimal_lte: Float # matches all nodes with lesser or equal value
  decimal_gt: Float # matches all nodes with greater value
  decimal_gte: Float # matches all nodes with greater or equal value


  # Boolean filters
  flag: Boolean # matches all nodes with exact value
  flag_not: Boolean # matches all nodes with different value

  # ID filters
  id: ID # matches all nodes with exact value
  id_not: ID # matches all nodes with different value
  id_in: [ID!] # matches all nodes with value in the passed list
  id_not_in: [ID!] # matches all nodes with value not in the passed list
  id_lt: ID # matches all nodes with lesser value
  id_lte: ID # matches all nodes with lesser or equal value
  id_gt: ID # matches all nodes with greater value
  id_gte: ID # matches all nodes with greater or equal value
  id_contains: ID # matches all nodes with a value that contains given substring
  id_not_contains: ID # matches all nodes with a value that does not contain given substring
  id_starts_with: ID # matches all nodes with a value that starts with given substring
  id_not_starts_with: ID # matches all nodes with a value that does not start with given substring
  id_ends_with: ID # matches all nodes with a value that ends with given substring
  id_not_ends_with: ID # matches all nodes with a value that does not end with given substring

  # Int filters
  number: Int # matches all nodes with exact value
  number_not: Int # matches all nodes with different value
  number_in: [Int!] # matches all nodes with value in the passed list
  number_not_in: [Int!] # matches all nodes with value not in the passed list
  number_lt: Int # matches all nodes with lesser value
  number_lte: Int # matches all nodes with lesser or equal value
  number_gt: Int # matches all nodes with greater value
  number_gte: Int # matches all nodes with greater or equal value

  # String filters
  text: String # matches all nodes with exact value
  text_not: String # matches all nodes with different value
  text_in: [String!] # matches all nodes with value in the passed list
  text_not_in: [String!] # matches all nodes with value not in the passed list
  text_lt: String # matches all nodes with lesser value
  text_lte: String # matches all nodes with lesser or equal value
  text_gt: String # matches all nodes with greater value
  text_gte: String # matches all nodes with greater or equal value
  text_contains: String # matches all nodes with a value that contains given substring
  text_not_contains: String # matches all nodes with a value that does not contain given substring
  text_starts_with: String # matches all nodes with a value that starts with given substring
  text_not_starts_with: String # matches all nodes with a value that does not start with given substring
  text_ends_with: String # matches all nodes with a value that ends with given substring
  text_not_ends_with: String # matches all nodes with a value that does not end with given substring
}
`;


*/