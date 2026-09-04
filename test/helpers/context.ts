import { randomBytes } from 'node:crypto';
import type { HttpClient, HttpRequestConfig, HttpResponse } from '../../src/http/http-client.js';
import type { ClientConfig } from '../../src/types/common.js';
import type { AuthenticationTokensResponse } from '../../src/types/auth.js';
import { Mode, FormCodes } from '../../src/types/common.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { SessionManager } from '../../src/session-manager.js';
import type { ResourceContext } from '../../src/resources/base-resource.js';

export const baseConfig: ClientConfig = {
  mode: Mode.Test,
  baseUrl: 'https://api-test.ksef.mf.gov.pl/v2',
  identifier: '1234563218',
  certificateBase64: '',
  certificatePassword: '',
  timeout: 30000,
  maxRetries: 0,
  formCode: FormCodes.FA3,
};

export type Handler = (
  config: HttpRequestConfig,
  index: number,
) => HttpResponse | Promise<HttpResponse>;

export interface MockHttp extends HttpClient {
  requests: HttpRequestConfig[];
}

export function mockHttp(handler: Handler): MockHttp {
  const client: MockHttp = {
    requests: [],
    async request(config: HttpRequestConfig): Promise<HttpResponse> {
      const index = client.requests.length;
      client.requests.push(config);
      return handler(config, index);
    },
  };
  return client;
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpResponse {
  const text = body === undefined ? '' : JSON.stringify(body);
  return { status, headers, body: text, rawBody: Buffer.from(text) };
}

export function text(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): HttpResponse {
  return { status, headers, body, rawBody: Buffer.from(body) };
}

export function futureDate(offsetMs = 3_600_000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

export function validTokens(): AuthenticationTokensResponse {
  return {
    accessToken: { token: 'access-jwt', validUntil: futureDate() },
    refreshToken: { token: 'refresh-jwt', validUntil: futureDate(7 * 24 * 3_600_000) },
  };
}

export interface TestContext {
  context: ResourceContext;
  http: MockHttp;
  tokens: TokenManager;
  session: SessionManager;
}

export function createContext(
  handler: Handler,
  overrides: Partial<ClientConfig> = {},
): TestContext {
  const http = mockHttp(handler);
  const tokens = new TokenManager();
  const session = new SessionManager();
  const context: ResourceContext = {
    httpClient: http,
    config: { ...baseConfig, ...overrides },
    tokens,
    session,
  };
  return { context, http, tokens, session };
}

export function authenticate(ctx: TestContext): AuthenticationTokensResponse {
  const tokens = validTokens();
  ctx.tokens.setTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export function openSession(
  ctx: TestContext,
  referenceNumber = '20260903-SO-0000000001-0000000001-01',
): {
  referenceNumber: string;
  key: Buffer;
  iv: Buffer;
} {
  const key = randomBytes(32);
  const iv = randomBytes(16);
  ctx.session.setSession({
    referenceNumber,
    validUntil: futureDate(),
    formCode: FormCodes.FA3,
    symmetricKey: key,
    initializationVector: iv,
  });
  return { referenceNumber, key, iv };
}

/** Routes requests by "METHOD path" (path relative to the base URL, query stripped). */
export function router(routes: Record<string, Handler>): Handler {
  return (config, index) => {
    const url = new URL(config.url);
    const relative =
      url.origin === new URL(baseConfig.baseUrl).origin
        ? url.pathname.replace(/^\/v2/, '')
        : config.url;
    const key = `${config.method} ${relative}`;
    const handler = routes[key];
    if (!handler) {
      throw new Error(`Unexpected request in test: ${key}`);
    }
    return handler(config, index);
  };
}
