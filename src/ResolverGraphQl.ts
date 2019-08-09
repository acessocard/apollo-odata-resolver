export interface ResolverGraphQl {
  nivel: number;
  value: string;
  parent: any;
  children: ResolverGraphQl[];
}

export class ResolverGraphQlClass implements ResolverGraphQl {
  constructor(public nivel: number, public value: string, public parent: any, public children: ResolverGraphQl[]) {}
}
