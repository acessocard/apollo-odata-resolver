import { DocumentNode } from 'graphql';

export interface Resolvers {
  mutations: Mutation[];
  name: string;
  querys: Query[];
}

export interface Query {
  name: string;
  func: (parent: any, args: any, context: any, info: any) => Promise<any>;
}

export interface Mutation {
  name: string;
  func: (parent: any, args: any, context: any, info: any) => Promise<any>;
}

export interface ODataResolver {
  nodes: string[];
  excludeFromOData: string[];
  url: string;
  typeDefs: DocumentNode;
  resolvers: Resolvers;
}

export interface ConfigurationService {
  GetConfiguration(): ODataResolverModel;
}

export class ODataResolverModel implements ODataResolver {
  constructor(public nodes: string[], public excludeFromOData: string[], public url: string, public typeDefs: DocumentNode, public resolvers: Resolvers) {}
}
