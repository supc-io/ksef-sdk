import type { HttpClient, HttpMethod, HttpResponse } from '../http/http-client.js';
import type { ClientConfig, Logger, RequestOptions } from '../types/common.js';
import type { SessionManager } from '../session-manager.js';
import { KsefApiError, KsefError } from '../errors/index.js';

interface SendOptions {
  body?: string | Buffer;
  contentType?: string;
  headers?: Record<string, string>;
  authenticated?: boolean;
  requestOptions?: RequestOptions;
}

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

  protected async requestJson<T>(
    method: HttpMethod,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      authenticated?: boolean;
      requestOptions?: RequestOptions;
    },
  ): Promise<T> {
    const response = await this.dispatch(method, path, {
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      contentType: 'application/json',
      headers: { Accept: 'application/json', ...options?.headers },
      authenticated: options?.authenticated,
      requestOptions: options?.requestOptions,
    });

    return parseJsonBody<T>(response, method, path);
  }

  protected async requestRaw(
    method: HttpMethod,
    path: string,
    options?: {
      body?: string | Buffer;
      headers?: Record<string, string>;
      authenticated?: boolean;
      requestOptions?: RequestOptions;
    },
  ): Promise<HttpResponse> {
    return this.dispatch(method, path, options ?? {});
  }

  private async dispatch(
    method: HttpMethod,
    path: string,
    options: SendOptions,
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = { ...options.headers };
    const authenticated = options.authenticated !== false;

    if (authenticated) {
      headers.SessionToken = this.sessionManager.requireToken();
    }

    if (options.body !== undefined && options.contentType && !hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = options.contentType;
    }

    const response = await this.httpClient.request({
      method,
      url: this.url(path),
      headers,
      body: options.body,
      timeout: options.requestOptions?.timeout ?? this.config.timeout,
      signal: options.requestOptions?.signal,
    });

    this.logger?.debug(`${method} ${path} -> ${response.status}`);

    if (response.status >= 400) {
      if (response.status === 401 && authenticated && this.sessionManager.isActive) {
        this.sessionManager.clear();
        this.logger?.warn('KSeF rejected the session token (HTTP 401); local session cleared');
      }
      throw KsefApiError.fromResponse(response.status, response.body, response.headers);
    }

    return response;
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function parseJsonBody<T>(response: HttpResponse, method: HttpMethod, path: string): T {
  const text = response.body.trim();
  if (text === '') {
    return undefined as unknown as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new KsefError(
      `KSeF returned a non-JSON response for ${method} ${path} (HTTP ${response.status})`,
      { cause: err },
    );
  }
}
