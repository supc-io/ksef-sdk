import { describe, it, expect } from 'vitest';
import { BaseResource } from '../../../src/resources/base-resource.js';
import { SessionManager } from '../../../src/session-manager.js';
import { AuthenticationError, KsefError, SessionError } from '../../../src/errors/index.js';
import type { HttpClient, HttpRequestConfig, HttpResponse } from '../../../src/http/http-client.js';
import type { ClientConfig, RequestOptions } from '../../../src/types/common.js';
import { Mode } from '../../../src/types/common.js';

class TestResource extends BaseResource {
  json<T>(
    method: 'GET' | 'POST',
    path: string,
    options?: { body?: unknown; authenticated?: boolean; requestOptions?: RequestOptions },
  ): Promise<T> {
    return this.requestJson<T>(method, path, options);
  }

  raw(path: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.requestRaw('GET', path, { headers });
  }
}

const baseConfig: ClientConfig = {
  mode: Mode.Test,
  baseUrl: 'https://ksef-test.mf.gov.pl/api',
  identifier: '1234563218',
  certificateBase64: '',
  certificatePassword: '',
  timeout: 1234,
  maxRetries: 0,
};

function mockClient(handler: (config: HttpRequestConfig) => HttpResponse): HttpClient & {
  requests: HttpRequestConfig[];
} {
  const client = {
    requests: [] as HttpRequestConfig[],
    async request(config: HttpRequestConfig): Promise<HttpResponse> {
      client.requests.push(config);
      return handler(config);
    },
  };
  return client;
}

function activeSession(): SessionManager {
  const sm = new SessionManager();
  sm.setSession('token-abc', 'ref-1');
  return sm;
}

describe('BaseResource', () => {
  it('sends JSON bodies with Content-Type, Accept and SessionToken headers', async () => {
    const http = mockClient(() => ({ status: 200, headers: {}, body: '{"ok":true}' }));
    const resource = new TestResource(http, baseConfig, activeSession());

    const result = await resource.json<{ ok: boolean }>('POST', '/x', { body: { a: 1 } });

    expect(result).toEqual({ ok: true });
    const request = http.requests[0];
    expect(request.url).toBe('https://ksef-test.mf.gov.pl/api/x');
    expect(request.body).toBe('{"a":1}');
    expect(request.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      SessionToken: 'token-abc',
    });
    expect(request.timeout).toBe(1234);
  });

  it('omits SessionToken and does not require a session for unauthenticated requests', async () => {
    const http = mockClient(() => ({ status: 200, headers: {}, body: '{}' }));
    const resource = new TestResource(http, baseConfig, new SessionManager());

    await resource.json('GET', '/public', { authenticated: false });

    expect(http.requests[0].headers?.SessionToken).toBeUndefined();
  });

  it('throws SessionError before sending when no session is active', async () => {
    const http = mockClient(() => ({ status: 200, headers: {}, body: '{}' }));
    const resource = new TestResource(http, baseConfig, new SessionManager());

    await expect(resource.json('GET', '/private')).rejects.toThrow(SessionError);
    expect(http.requests).toHaveLength(0);
  });

  it('returns undefined for an empty 2xx body instead of throwing on JSON.parse', async () => {
    const http = mockClient(() => ({ status: 204, headers: {}, body: '' }));
    const resource = new TestResource(http, baseConfig, activeSession());

    await expect(resource.json('GET', '/empty')).resolves.toBeUndefined();
  });

  it('wraps a non-JSON 2xx body in KsefError', async () => {
    const http = mockClient(() => ({ status: 200, headers: {}, body: '<html>proxy</html>' }));
    const resource = new TestResource(http, baseConfig, activeSession());

    await expect(resource.json('GET', '/html')).rejects.toThrow(KsefError);
    await expect(resource.json('GET', '/html')).rejects.toThrow(/non-JSON response for GET \/html/);
  });

  it('clears the local session when KSeF answers 401 to an authenticated request', async () => {
    const http = mockClient(() => ({
      status: 401,
      headers: {},
      body: JSON.stringify({
        exception: {
          exceptionDetailList: [{ exceptionCode: 21301, exceptionDescription: 'Session expired' }],
        },
      }),
    }));
    const sessionManager = activeSession();
    const resource = new TestResource(http, baseConfig, sessionManager);

    await expect(resource.json('GET', '/private')).rejects.toThrow(AuthenticationError);
    expect(sessionManager.isActive).toBe(false);
  });

  it('keeps the session on 401 from an unauthenticated request', async () => {
    const http = mockClient(() => ({ status: 401, headers: {}, body: '{}' }));
    const sessionManager = activeSession();
    const resource = new TestResource(http, baseConfig, sessionManager);

    await expect(resource.json('GET', '/public', { authenticated: false })).rejects.toThrow(
      AuthenticationError,
    );
    expect(sessionManager.isActive).toBe(true);
  });

  it('passes per-request timeout and signal through', async () => {
    const http = mockClient(() => ({ status: 200, headers: {}, body: '{}' }));
    const resource = new TestResource(http, baseConfig, activeSession());
    const controller = new AbortController();

    await resource.json('GET', '/x', { requestOptions: { timeout: 5, signal: controller.signal } });

    expect(http.requests[0].timeout).toBe(5);
    expect(http.requests[0].signal).toBe(controller.signal);
  });

  it('requestRaw returns the full response including rawBody', async () => {
    const raw = Buffer.from([1, 2, 3]);
    const http = mockClient(() => ({ status: 200, headers: {}, body: 'x', rawBody: raw }));
    const resource = new TestResource(http, baseConfig, activeSession());

    const response = await resource.raw('/bin', { Accept: 'application/octet-stream' });

    expect(response.rawBody).toBe(raw);
    expect(http.requests[0].headers?.Accept).toBe('application/octet-stream');
    expect(http.requests[0].headers?.['Content-Type']).toBeUndefined();
  });
});
