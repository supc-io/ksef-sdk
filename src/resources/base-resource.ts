import type { HttpClient, HttpMethod, HttpResponse } from '../http/http-client.js';
import type { ClientConfig, Logger, RequestOptions } from '../types/common.js';
import type { TokenInfo } from '../types/auth.js';
import type { TokenManager } from '../auth/token-manager.js';
import type { SessionManager } from '../session-manager.js';
import { KsefApiError, KsefError } from '../errors/index.js';

/** Refreshes the access token; implemented by `AuthResource`. */
export interface TokenRefresher {
  refreshAccessToken(requestOptions?: RequestOptions): Promise<TokenInfo>;
}

/** Shared state handed to every resource by `KsefClient`. */
export interface ResourceContext {
  httpClient: HttpClient;
  config: ClientConfig;
  tokens: TokenManager;
  session: SessionManager;
  /** Wired by `KsefClient` once the auth resource exists. */
  refresher?: TokenRefresher;
}

/**
 * How a request is authenticated:
 * - `access` (default): `Authorization: Bearer <accessToken>`, refreshed automatically
 * - `bearer`: an explicit token (authentication token, refresh token)
 * - `none`: public endpoint
 */
export type RequestAuth = { type: 'access' } | { type: 'bearer'; token: string } | { type: 'none' };

export type QueryParams = Record<string, string | number | boolean | undefined>;

interface DispatchOptions {
  body?: string | Buffer;
  contentType?: string;
  headers?: Record<string, string>;
  query?: QueryParams;
  auth?: RequestAuth;
  requestOptions?: RequestOptions;
}

export interface JsonRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  query?: QueryParams;
  auth?: RequestAuth;
  requestOptions?: RequestOptions;
}

export interface TextRequestOptions {
  accept?: string;
  headers?: Record<string, string>;
  query?: QueryParams;
  auth?: RequestAuth;
  requestOptions?: RequestOptions;
}

export abstract class BaseResource {
  constructor(protected readonly context: ResourceContext) {}

  protected get config(): ClientConfig {
    return this.context.config;
  }

  protected get logger(): Logger | undefined {
    return this.context.config.logger;
  }

  /** Builds an absolute URL; `path` may already be absolute (pre-signed download links). */
  protected url(path: string, query?: QueryParams): string {
    const base = /^https?:\/\//.test(path) ? path : `${this.config.baseUrl}${path}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }

  protected async requestJson<T>(
    method: HttpMethod,
    path: string,
    options?: JsonRequestOptions,
  ): Promise<T> {
    const response = await this.dispatch(method, path, {
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      contentType: 'application/json',
      headers: { Accept: 'application/json', ...options?.headers },
      query: options?.query,
      auth: options?.auth,
      requestOptions: options?.requestOptions,
    });

    return parseJsonBody<T>(response, method, path);
  }

  /** Requests a text (XML) document, e.g. an invoice or UPO. */
  protected async requestText(
    method: HttpMethod,
    path: string,
    options?: TextRequestOptions,
  ): Promise<string> {
    const response = await this.dispatch(method, path, {
      headers: { Accept: options?.accept ?? 'application/xml', ...options?.headers },
      query: options?.query,
      auth: options?.auth,
      requestOptions: options?.requestOptions,
    });
    return response.body;
  }

  protected async requestRaw(
    method: HttpMethod,
    path: string,
    options?: DispatchOptions,
  ): Promise<HttpResponse> {
    return this.dispatch(method, path, options ?? {});
  }

  private async dispatch(
    method: HttpMethod,
    path: string,
    options: DispatchOptions,
  ): Promise<HttpResponse> {
    const auth = options.auth ?? { type: 'access' };
    let refreshed = false;

    for (;;) {
      const headers: Record<string, string> = { ...options.headers };

      if (auth.type === 'access') {
        headers.Authorization = `Bearer ${await this.resolveAccessToken(options.requestOptions)}`;
      } else if (auth.type === 'bearer') {
        headers.Authorization = `Bearer ${auth.token}`;
      }

      if (
        options.body !== undefined &&
        options.contentType &&
        !hasHeader(headers, 'content-type')
      ) {
        headers['Content-Type'] = options.contentType;
      }

      const response = await this.context.httpClient.request({
        method,
        url: this.url(path, options.query),
        headers,
        body: options.body,
        timeout: options.requestOptions?.timeout ?? this.config.timeout,
        signal: options.requestOptions?.signal,
      });

      this.logger?.debug(`${method} ${path} -> ${response.status}`);

      if (
        response.status === 401 &&
        auth.type === 'access' &&
        !refreshed &&
        this.context.refresher &&
        this.context.tokens.canRefresh()
      ) {
        refreshed = true;
        this.logger?.info('KSeF rejected the access token (401); refreshing it and retrying once');
        await this.context.refresher.refreshAccessToken(options.requestOptions);
        continue;
      }

      if (response.status >= 400) {
        if (response.status === 401 && auth.type === 'access') {
          this.context.tokens.clear();
          this.context.session.clear();
          this.logger?.warn(
            'KSeF rejected the access token (HTTP 401); local tokens and session cleared',
          );
        }
        throw KsefApiError.fromResponse(response.status, response.body, response.headers);
      }

      return response;
    }
  }

  private async resolveAccessToken(requestOptions?: RequestOptions): Promise<string> {
    const tokens = this.context.tokens;
    if (
      tokens.isAuthenticated &&
      tokens.isAccessTokenExpired() &&
      tokens.canRefresh() &&
      this.context.refresher
    ) {
      this.logger?.debug('Access token expired; refreshing before the request');
      await this.context.refresher.refreshAccessToken(requestOptions);
    }
    return tokens.requireAccessToken();
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
