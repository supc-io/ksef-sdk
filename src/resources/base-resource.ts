import type { HttpClient, HttpResponse } from '../http/http-client.js';
import type { ClientConfig, Logger, RequestOptions } from '../types/common.js';
import type { SessionManager } from '../session-manager.js';
import { KsefApiError } from '../errors/index.js';
import { parseXml } from '../utils/xml.js';

export abstract class BaseResource {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly config: ClientConfig,
    protected readonly sessionManager: SessionManager,
  ) {}

  protected get logger(): Logger | undefined {
    return this.config.logger;
  }

  protected url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  protected authHeaders(): Record<string, string> {
    const token = this.sessionManager.requireToken();
    return { SessionToken: token };
  }

  protected async requestJson<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      authenticated?: boolean;
      requestOptions?: RequestOptions;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options?.headers,
    };

    if (options?.authenticated !== false) {
      Object.assign(headers, this.authHeaders());
    }

    let bodyStr: string | undefined;
    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(options.body);
    }

    const response = await this.httpClient.request({
      method,
      url: this.url(path),
      headers,
      body: bodyStr,
      timeout: options?.requestOptions?.timeout ?? this.config.timeout,
      signal: options?.requestOptions?.signal,
    });

    this.logger?.debug(`${method} ${path} -> ${response.status}`);

    if (response.status >= 400) {
      throw KsefApiError.fromResponse(response.status, response.body, response.headers);
    }

    return JSON.parse(response.body) as T;
  }

  protected async requestXml<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: {
      body?: string;
      headers?: Record<string, string>;
      authenticated?: boolean;
      requestOptions?: RequestOptions;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/xml',
      ...options?.headers,
    };

    if (options?.authenticated !== false) {
      Object.assign(headers, this.authHeaders());
    }

    if (options?.body) {
      headers['Content-Type'] = 'application/xml';
    }

    const response = await this.httpClient.request({
      method,
      url: this.url(path),
      headers,
      body: options?.body,
      timeout: options?.requestOptions?.timeout ?? this.config.timeout,
      signal: options?.requestOptions?.signal,
    });

    this.logger?.debug(`${method} ${path} -> ${response.status}`);

    if (response.status >= 400) {
      throw KsefApiError.fromResponse(response.status, response.body, response.headers);
    }

    return parseXml<T>(response.body);
  }

  protected async requestRaw(
    method: 'GET' | 'POST',
    path: string,
    options?: {
      body?: string | Buffer;
      headers?: Record<string, string>;
      authenticated?: boolean;
      requestOptions?: RequestOptions;
    },
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      ...options?.headers,
    };

    if (options?.authenticated !== false) {
      Object.assign(headers, this.authHeaders());
    }

    const response = await this.httpClient.request({
      method,
      url: this.url(path),
      headers,
      body: options?.body,
      timeout: options?.requestOptions?.timeout ?? this.config.timeout,
      signal: options?.requestOptions?.signal,
    });

    if (response.status >= 400) {
      throw KsefApiError.fromResponse(response.status, response.body, response.headers);
    }

    return response;
  }
}
