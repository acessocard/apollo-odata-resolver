import { GraphQLExtensionStack } from 'graphql-extensions';
import { ODataResolver } from './data-struct';
import { ResolverGraphQl, ResolverGraphQlClass } from './ResolverGraphQl';
import { Fetch } from './fetch-ts/Fetch';
import { ObjectTypeDefinitionNode, FieldDefinitionNode, NamedTypeNode, TypeNode, DocumentNode, EnumTypeDefinitionNode } from 'graphql';
import { gql } from 'apollo-server';

export class ApolloODataResolver {
  fetch: Fetch;
  list: ODataResolver[] = [];

  private readonly select = '$select=';
  private readonly expand = '$expand=';
  private readonly filter = '$filter=';
  private readonly typesQl = ['DateTime', 'Float', 'Boolean', 'ID', 'Int', 'String'];
  private filtersResolved: any[] = [];
  TypeDefs: DocumentNode;
  private listTypes: any[];

  constructor(public listNodesAndUrl: ODataResolver[], fetch: Fetch) {
    this.fetch = fetch;
    this.list = this.list.concat(listNodesAndUrl);
    this.TypeDefs = this.buildTypeDefs();
    this.listTypes = [this.TypeDefs, ...listNodesAndUrl.map(x => x.typeDefs)]
      .map(x => x.definitions)
      .flat()
      .map((x: any) => x.fields)
      .flat()
      .filter(x => x !== undefined && x.kind !== 'InputValueDefinition')
      .map(x => Object({ name: x.name.value, type: x.type, kind: x.type.kind })); //.filter(x=> x.kind !== "NamedType")
  }

  async resolverODataAndCall(_: any, args: any, context: GraphQLExtensionStack, info: any): Promise<any> {
    if (!info) {
      throw new Error('Info is null');
    }

    const node = this.list.find(x => x.nodes.some(item => item === info.fieldName));
    if (!node) {
      throw new Error(`Node not configuration for ${info.fieldName}`);
    }

    return this.findBy(node, args, info, context);
  }

  private buildTypeDefs(): DocumentNode {
    const listTypeDefs: string[] = [];

    for (const node of this.list) {
      const definitionsFiltred = node.typeDefs.definitions
        .filter(definition => definition.kind === 'ObjectTypeDefinition' || definition.kind === 'EnumTypeDefinition')
        .filter(definition => !(node.excludeFromOData.indexOf((definition as ObjectTypeDefinitionNode).name.value.toLowerCase()) > -1));

      const enums = definitionsFiltred.filter(definition => definition.kind === 'EnumTypeDefinition').map(x => (x as EnumTypeDefinitionNode).name.value);
      for (const definition of definitionsFiltred) {
        const listTypes: string[] = [];

        if (definition.kind === 'ObjectTypeDefinition') {
          const _class = (definition as unknown) as ObjectTypeDefinitionNode;
          this.ResolverNamesSchema(_class.fields!, node, enums, listTypes);

          const name = `${_class.name.value}Filter`;
          const andOr = `[${name}!]`;
          listTypeDefs.push(`input ${name} {\n\tAND: ${andOr}\n\tOR: ${andOr}\n\t${listTypes.join('\n\t')}\n}`);
        }
      }
    }

    return gql`
      ${listTypeDefs.join(`\n`)}
    `;
  }

  private async findBy(node: ODataResolver, args: any, info: any, context: any): Promise<any> {
    let json: any = {};

    const objectKeys = Object.keys(args);
    if (args.id && objectKeys.length === 1) {
      const resolved = this.resolverOData(info, node);
      json = await this.callFetch<any>(`${node.url}(${args.id})?${resolved}`, context);
    } else if (!args.id && objectKeys.length > 0) {
      // em construção

      this.filtersResolved = this.resolverFilters(args, objectKeys, 0);
      const resolved = this.resolverOData(info, node);

      const hasQuery = this.filtersResolved.filter(x => x.parent === '');
      let query = '';
      if (hasQuery.length > 0) {
        query = hasQuery[0].query;
      }
      const uri = `${node.url}?${resolved}${query ? '&' : ''}${query ? this.filter : ''}`;

      const hasFilter = uri.includes('&$filter=');
      let queryString = '';

      if (!hasFilter) {
        queryString = `${node.url}?${resolved}${query ? '&' : ''}${query ? this.filter : ''}${query}`;
      } else {
        const endUri = query ? `AND ${query}` : '';
        queryString = `${node.url}?${resolved} ${endUri}`;
      }
      json = await this.callFetch<any>(queryString, context);
    } else {
      const resolved = this.resolverOData(info, node);
      json = await this.callFetch<any>(`${node.url}?${resolved}`, context);
    }
    return json.error ? json : json.value ? json.value : json;
  }

  private async callFetch<T>(url: string, context: any): Promise<T> {
    const res = await this.fetch.Call(url, { method: 'GET', headers: context.req.headers, body: {} });
    return res as T;
  }

  /*
Eq	Equal	/Suppliers?$filter=Address/City eq 'Redmond'
Ne	Not equal	/Suppliers?$filter=Address/City ne 'London'
Not Logical negation	/Products?$filter=not eq 'milk'
Gt	Greater than	/Products?$filter=Price gt 20
Ge	Greater than or equal	/Products?$filter=Price ge 10
Lt	Less than	/Products?$filter=Price lt 20
Le	Less than or equal	/Products?$filter=Price le 100
And	Logical and	/Products?$filter=Price le 200 and Price gt 3.5
Or	Logical or	/Products?$filter=Price le 3.5 or Price gt 200
*/

  private resolverQuery(parent: string, args: any, objectKeys: string[], nivel: number): QueryItemFilter[] {
    let queries: QueryItemFilter[] = [];

    objectKeys.forEach(arg => {
      const item = args[arg];
      const value = typeof item === 'string' ? `'${item}'` : item;

      if (typeof item === 'object') {
        const n = nivel + 1;
        const anotherQueries = this.resolverQuery(nivel > 0 ? arg : '', item, Object.keys(item), n);

        queries = queries.concat(anotherQueries);
      } else {
        const arr = arg.split(/_/g);
        switch (arr.length) {
          case 1:
            queries.push(new QueryItemFilter(nivel, `${arr[0]} eq ${value}`, parent));
            break;
          case 2:
            queries.push(new QueryItemFilter(nivel, `${arr[0]} ${arr[1]} ${value}`, parent));
            break;
          case 3:
            queries.push(new QueryItemFilter(nivel, `${arr[0]} ${arr[1]} ${arr[2]} ${value}`, parent));
            break;
          case 4:
            queries.push(new QueryItemFilter(nivel, `${arr[0]} ${arr[1]} ${arr[2]} ${arr[3]} ${value}`, parent));
            break;
          default:
            break;
        }
      }
    });
    return queries;
  }

  private static groupBy(list: any[], keyGetter: Function): any[] {
    const map = new Map();
    list.forEach(item => {
      const key = keyGetter(item);
      const collection = map.get(key);
      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    });
    return Array.from(map);
  }

  private resolverFilters(args: any, objectKeys: string[], nivel: number): any[] {
    const p = this.resolverQuery('', args, objectKeys, nivel);
    const grouped = ApolloODataResolver.groupBy(p, (x: QueryItemFilter) => x.parent);

    const queries = grouped
      .map((x: any) => x.filter((m: any) => Array.isArray(m)))
      .map(x => x.map((p: any) => Object({ parent: p[0].parent, query: `${p.map((t: QueryItemFilter) => t.query).join(' AND ')}` })))
      .flat();

    return queries;
  }

  private resolverOData(info: any, node: ODataResolver): string {
    const resolvido = this.rs(0, info.fieldNodes[0].selectionSet.selections, info.fieldNodes[0].name.value);
    return this.resolveQueryString(0, resolvido, node);
  }

  private resolveQueryString(nivel: number, lista: ResolverGraphQl[], node: ODataResolver): string {
    const hasChildren = lista.some(x => x.children.length > 0);

    let uri = `${this.select}${lista
      .filter(x => x.children.length <= 0)
      .map(x => x.value)
      .filter(x => !node.excludeFromOData.includes(x))}`;
    if (hasChildren) {
      const hasChildrens = lista.filter(x => x.children.length > 0);
      let hasExpand = false;
      for (const element of hasChildrens) {
        if (node.excludeFromOData.includes(element.value)) {
          continue;
        }
        const concat = nivel > 0 ? ';' : '&';
        const hasFilter = this.filtersResolved.filter(x => x.parent === element.value);
        let filter = '';
        if (hasFilter.length > 0) {
          filter = hasFilter[0].query;
        }

        const listDefinition = this.listTypes.filter(x => x.kind === 'ListType').filter(x => x.name === element.value)[0];

        // ajustar aqui
        const filterQuery = this.resolveQueryString(nivel + 1, element.children, node);
        if (listDefinition) {
          const child = `${hasExpand ? ',' : concat}${!hasExpand ? this.expand : ''}${element.value}(${filter ? this.filter + filter + ';' : ''} ${filterQuery})`;
          uri += child;
        } else {
          let filterString = filter ? `&${this.filter}${element.value}/${filter}` : '';
          filterString = filterString.replace('AND ', `AND ${element.value}/`).replace('OR ', `AND ${element.value}/`);
          const child = `${hasExpand ? ',' : concat}${!hasExpand ? this.expand : ''}${element.value}(${filterQuery})${filterString}`;
          uri += child;
        }
        hasExpand = true;
      }
    }
    return uri;
  }

  private rs(nivel: number, listKind: any[], parent: any): ResolverGraphQl[] {
    let arr: ResolverGraphQl[] = [];
    for (const element of listKind) {
      const child: ResolverGraphQl[] = !element.selectionSet ? [] : this.rs(nivel + 1, element.selectionSet.selections, element.name.value);
      arr = arr.concat([new ResolverGraphQlClass(nivel, element.name.value, parent, child)]);
    }
    return arr;
  }

  private ResolverNamesSchema(fields: ReadonlyArray<FieldDefinitionNode>, node: ODataResolver, enums: string[], listTypes: string[]) {
    for (const field of fields) {
      if (field.kind === 'FieldDefinition') {
        const fieldCast = field;
        const fieldName = fieldCast.name.value;
        const typed = CastTypes(fieldCast.type);
        const type = typed.name.value;
        if (!(node.excludeFromOData.indexOf(fieldName) > -1)) {
          const isPrimitive = this.typesQl.indexOf(type) > -1;
          const isEnum = enums.indexOf(type) > -1;
          if (isEnum) {
            listTypes.push(`${fieldName}: ${type}`);
          } else if (isPrimitive) {
            listTypes.push(replace(fieldName, type));
          } else {
            listTypes.push(`${fieldName}: ${type + 'Filter'}`);
          }
        }
      } else {
        throw new Error('Field desconhecido');
      }
    }
  }
}

class QueryItemFilter {
  constructor(public nivel: number, public query: string, public parent: string) {}
}

const CastTypes = (fieldCast: TypeNode): NamedTypeNode => {
  switch (fieldCast.kind) {
    case 'NamedType':
      return fieldCast;
    case 'NonNullType':
    case 'ListType':
      return CastTypes(fieldCast.type);
    default:
      throw new Error('Não foi possivel converter');
  }
};

const replace = (name: string, type: string): string => {
  switch (type) {
    case 'DateTime':
      return dateTime(name);
    case 'Float':
      return float(name);
    case 'Boolean':
      return boolean(name);
    case 'ID':
      return id(name);
    case 'Int':
      return int(name);
    case 'String':
      return string(name);
    default:
      throw Error('erro na criação dos fields');
  }
};

const dateTime = (name: string) => {
  return ` # DateTime filters
  ${name}: DateTime # matches all nodes with exact value
  ${name}_ne: DateTime # matches all nodes with different value`;
  // ${name}_in: [DateTime!] # matches all nodes with value in the passed list
  // ${name}_not_in: [DateTime!] # matches all nodes with value not in the passed list
  // ${name}_lt: DateTime # matches all nodes with lesser value
  // ${name}_lte: DateTime # matches all nodes with lesser or equal value
  // ${name}_gt: DateTime # matches all nodes with greater value
  // ${name}_gte: DateTime # matches all nodes with greater or equal value`;
};

const float = (name: string) => {
  return ` # Float filters
  ${name}: Float # matches all nodes with exact value
  ${name}_ne: Float # matches all nodes with different value`;
  // ${name}_in: [Float!] # matches all nodes with value in the passed list
  // ${name}_not_in: [Float!] # matches all nodes with value not in the passed list
  // ${name}_lt: Float # matches all nodes with lesser value
  // ${name}_lte: Float # matches all nodes with lesser or equal value
  // ${name}_gt: Float # matches all nodes with greater value
  // ${name}_gte: Float # matches all nodes with greater or equal value`;
};

const boolean = (name: string) => {
  return ` # Boolean filters
  ${name}: Boolean # matches all nodes with exact value
  ${name}_ne: Boolean # matches all nodes with different value`;
};

const id = (name: string) => {
  return ` # ID filters
  ${name}: ID # matches all nodes with exact value
  ${name}_ne: ID # matches all nodes with different value`;
  // ${name}_in: [ID!] # matches all nodes with value in the passed list
  // ${name}_not_in: [ID!] # matches all nodes with value not in the passed list
  // ${name}_lt: ID # matches all nodes with lesser value
  // ${name}_lte: ID # matches all nodes with lesser or equal value
  // ${name}_gt: ID # matches all nodes with greater value
  // ${name}_gte: ID # matches all nodes with greater or equal value
  // ${name}_contains: ID # matches all nodes with a value that contains given substring
  // ${name}_not_contains: ID # matches all nodes with a value that does not contain given substring
  // ${name}_starts_with: ID # matches all nodes with a value that starts with given substring
  // ${name}_not_starts_with: ID # matches all nodes with a value that does not start with given substring
  // ${name}_ends_with: ID # matches all nodes with a value that ends with given substring
  // ${name}_not_ends_with: ID # matches all nodes with a value that does not end with given substring`;
};

const int = (name: string) => {
  return `  # Int filters
  ${name}: Int # matches all nodes with exact value
  ${name}_ne: Int # matches all nodes with different value`;
  // ${name}_in: [Int!] # matches all nodes with value in the passed list
  // ${name}_not_in: [Int!] # matches all nodes with value not in the passed list
  // ${name}_lt: Int # matches all nodes with lesser value
  // ${name}_lte: Int # matches all nodes with lesser or equal value
  // ${name}_gt: Int # matches all nodes with greater value
  // ${name}_gte: Int # matches all nodes with greater or equal value`;
};

const string = (name: string) => {
  return `  # String filters
  ${name}: String # matches all nodes with exact value
  ${name}_ne: String # matches all nodes with different value`;
  // ${name}_in: [String!] # matches all nodes with value in the passed list
  // ${name}_not_in: [String!] # matches all nodes with value not in the passed list
  // ${name}_lt: String # matches all nodes with lesser value
  // ${name}_lte: String # matches all nodes with lesser or equal value
  // ${name}_gt: String # matches all nodes with greater value
  // ${name}_gte: String # matches all nodes with greater or equal value
  // ${name}_contains: String # matches all nodes with a value that contains given substring
  // ${name}_not_contains: String # matches all nodes with a value that does not contain given substring
  // ${name}_starts_with: String # matches all nodes with a value that starts with given substring
  // ${name}_not_starts_with: String # matches all nodes with a value that does not start with given substring
  // ${name}_ends_with: String # matches all nodes with a value that ends with given substring
  // ${name}_not_ends_with: String # matches all nodes with a value that does not end with given substring`;
};

/*

['DateTime' ,'Float' ,'Boolean', 'ID', 'Int', 'String']

const QueryTypeDefs = `
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
