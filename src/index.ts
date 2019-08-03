import { GraphQLExtensionStack } from 'graphql-extensions';
import { ODataResolver } from './data-struct';
import { ResolverGraphQl, ResolverGraphQlClass } from './ResolverGraphQl';
import { Fetch } from './fetch-ts/Fetch';

export class ApolloODataResolver {
  fetch: Fetch;
  list: ODataResolver[] = [];

  readonly select = '$select=';
  readonly expand = '$expand=';
  readonly filter = '$filter=';

  constructor(public listNodesAndUrl: ODataResolver[], fetch: Fetch) {
    this.fetch = fetch;
    this.list = this.list.concat(listNodesAndUrl);
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

  private async findBy(node: ODataResolver, args: any, info: any, context: any): Promise<any> {
    let json: any = {};
    const resolved = this.resolverOData(info, node);
    const objectKeys = Object.keys(args);
    if (args.id && objectKeys.length === 1) {
      json = await this.callFetch<any>(`${node.url}(${args.id})?${resolved}`, context);
    } else if (!args.id && objectKeys.length > 0) {
      json = await this.callFetch<any>(`${node.url}?${resolved}&${this.resolverFilters(args, objectKeys)}`, context);
    } else {
      json = await this.callFetch<any>(`${node.url}?${resolved}`, context);
    }
    return json.error ? json : json.value ? json.value : json;
  }

  private async callFetch<T>(url: string, context: any): Promise<T> {
    const res = await this.fetch.Call(url, { method: 'GET', headers: context.req.headers, body: {} });
    return res as T;
  }

  private resolverFilters(args: any, objectKeys: string[]): string {
    const queries: string[] = [];

    objectKeys.forEach(arg => {
      const item = args[arg];
      const value = typeof item === 'string' ? `'${item}'` : item;

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

    return queries.length > 0 ? `${this.filter}${queries.join(' ')}` : '';
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
        const child = `${hasExpand ? ',' : concat}${!hasExpand ? this.expand : ''}${element.value}(${this.resolveQueryString(nivel + 1, element.children, node)})`;
        hasExpand = true;
        uri += child;
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
}
