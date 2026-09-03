export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  /** Response body decoded as UTF-8 text. */
  body: string;
  /**
   * Raw response bytes. Populated by `DefaultHttpClient`; custom clients should
   * set it too so that binary downloads (exports) are not corrupted by text decoding.
   */
  rawBody?: Buffer;
}

export interface HttpClient {
  request(config: HttpRequestConfig): Promise<HttpResponse>;
}
