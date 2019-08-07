/* istanbul ignore file */
import axios from 'axios';

export type Method = 'get' | 'GET' | 'delete' | 'DELETE' | 'head' | 'HEAD' | 'options' | 'OPTIONS' | 'post' | 'POST' | 'put' | 'PUT' | 'patch' | 'PATCH';

export interface Fetch {
  Call(url: string, init?: RequestOptions): Promise<any>;
}

export interface RequestOptions {
  method: Method;
  headers: any;
  body?: any;
}

export class FetchClass implements Fetch {
  async Call(url: string, init?: RequestOptions): Promise<any> {
    const result = await axios(url, {
      method: init!.method,
      headers: init!.headers,
      data: init!.body,
    });

    // TODO: verificar como validar melhor o retorno
    return result.data;
  }
}
