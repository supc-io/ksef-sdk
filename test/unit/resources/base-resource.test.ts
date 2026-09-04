import { describe, it, expect, vi } from 'vitest';
import { BaseResource } from '../../../src/resources/base-resource.js';
import type {
  JsonRequestOptions,
  TextRequestOptions,
} from '../../../src/resources/base-resource.js';
import type { HttpResponse } from '../../../src/http/http-client.js';
import {
  AuthenticationError,
  KsefError,
  PermissionDeniedError,
  RateLimitError,
  SessionError,
} from '../../../src/errors/index.js';
import { authenticate, createContext, futureDate, json, text } from '../../helpers/context.js';

class TestResource extends BaseResource {
  json<T>(method: 'GET' | 'POST', path: string, options?: JsonRequestOptions): Promise<T> {
    return this.requestJson<T>(method, path, options);
  }

  text(path: string, options?: TextRequestOptions): Promise<string> {
    return this.requestText('GET', path, options);
  }

  raw(path: string): Promise<HttpResponse> {
    return this.requestRaw('GET', path);
  }
}

describe('BaseResource', () => {
  it('sends JSON with Bearer, Accept and Content-Type headers and query params', async () => {
    const ctx = createContext(() => json(200, { ok: true }));
    authenticate(ctx);
    const resource = new TestResource(ctx.context);

    const result = await resource.json<{ ok: boolean }>('POST', '/x', {
      body: { a: 1 },
      query: { pageSize: 10, skip: undefined, flag: true },
    });

    expect(result).toEqual({ ok: true });
    const request = ctx.http.requests[0];
    expect(request.url).toBe('https://api-test.ksef.mf.gov.pl/v2/x?pageSize=10&flag=true');
    expect(request.body).toBe('{"a":1}');
    expect(request.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-jwt',
    });
    expect(request.timeout).toBe(30000);
  });

  it('supports public endpoints and explicit bearer tokens', async () => {
    const ctx = createContext(() => json(200, {}));
    const resource = new TestResource(ctx.context);

    await resource.json('GET', '/public', { auth: { type: 'none' } });
    await resource.json('GET', '/auth/x', { auth: { type: 'bearer', token: 'auth-token' } });

    expect(ctx.http.requests[0].headers?.Authorization).toBeUndefined();
    expect(ctx.http.requests[1].headers?.Authorization).toBe('Bearer auth-token');
  });

  it('throws SessionError before sending when not authenticated', async () => {
    const ctx = createContext(() => json(200, {}));
    const resource = new TestResource(ctx.context);

    await expect(resource.json('GET', '/private')).rejects.toThrow(SessionError);
    expect(ctx.http.requests).toHaveLength(0);
  });

  it('refreshes an expired access token before the request', async () => {
    const ctx = createContext(() => json(200, {}));
    ctx.tokens.setTokens(
      { token: 'old', validUntil: futureDate(-1000) },
      { token: 'r', validUntil: futureDate() },
    );
    const refresher = {
      refreshAccessToken: vi.fn(async () => {
        const fresh = { token: 'fresh', validUntil: futureDate() };
        ctx.tokens.setAccessToken(fresh);
        return fresh;
      }),
    };
    ctx.context.refresher = refresher;
    const resource = new TestResource(ctx.context);

    await resource.json('GET', '/x');

    expect(refresher.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(ctx.http.requests[0].headers?.Authorization).toBe('Bearer fresh');
  });

  it('retries once with a refreshed token after a 401', async () => {
    const ctx = createContext((_config, index) =>
      index === 0
        ? json(401, { title: 'Unauthorized', status: 401, detail: 'expired' })
        : json(200, { ok: 1 }),
    );
    authenticate(ctx);
    ctx.context.refresher = {
      refreshAccessToken: async () => {
        const fresh = { token: 'fresh', validUntil: futureDate() };
        ctx.tokens.setAccessToken(fresh);
        return fresh;
      },
    };
    const resource = new TestResource(ctx.context);

    await expect(resource.json('GET', '/x')).resolves.toEqual({ ok: 1 });
    expect(ctx.http.requests).toHaveLength(2);
    expect(ctx.http.requests[0].headers?.Authorization).toBe('Bearer access-jwt');
    expect(ctx.http.requests[1].headers?.Authorization).toBe('Bearer fresh');
  });

  it('clears tokens and session when the refreshed token is rejected too', async () => {
    const ctx = createContext(() =>
      json(401, { title: 'Unauthorized', status: 401, detail: 'nope' }),
    );
    authenticate(ctx);
    ctx.session.setSession({
      referenceNumber: 'ref',
      validUntil: futureDate(),
      formCode: ctx.context.config.formCode,
      symmetricKey: Buffer.alloc(32),
      initializationVector: Buffer.alloc(16),
    });
    ctx.context.refresher = {
      refreshAccessToken: async () => {
        const fresh = { token: 'fresh', validUntil: futureDate() };
        ctx.tokens.setAccessToken(fresh);
        return fresh;
      },
    };
    const resource = new TestResource(ctx.context);

    const error = await resource.json('GET', '/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthenticationError);
    expect((error as AuthenticationError).message).toBe('nope');
    expect(ctx.http.requests).toHaveLength(2);
    expect(ctx.tokens.isAuthenticated).toBe(false);
    expect(ctx.session.isActive).toBe(false);
  });

  it('does not retry a 401 without a usable refresh token', async () => {
    const ctx = createContext(() =>
      json(401, { title: 'Unauthorized', status: 401, detail: 'nope' }),
    );
    ctx.tokens.setTokens(
      { token: 'a', validUntil: futureDate() },
      { token: 'r', validUntil: futureDate(-1) },
    );
    ctx.context.refresher = { refreshAccessToken: vi.fn() };
    const resource = new TestResource(ctx.context);

    await expect(resource.json('GET', '/x')).rejects.toThrow(AuthenticationError);
    expect(ctx.http.requests).toHaveLength(1);
    expect(ctx.context.refresher.refreshAccessToken).not.toHaveBeenCalled();
    expect(ctx.tokens.isAuthenticated).toBe(false);
  });

  it('maps problem+json and 429 bodies to typed errors', async () => {
    const ctx = createContext((_config, index) =>
      index === 0
        ? json(403, {
            title: 'Forbidden',
            status: 403,
            detail: 'Brak uprawnień',
            reasonCode: 'missing-permissions',
          })
        : json(429, {
            status: { code: 429, description: 'Too Many Requests', details: ['Limit 20/min.'] },
          }),
    );
    authenticate(ctx);
    const resource = new TestResource(ctx.context);

    const forbidden = await resource.json('GET', '/x').catch((e: unknown) => e);
    expect(forbidden).toBeInstanceOf(PermissionDeniedError);
    expect((forbidden as PermissionDeniedError).message).toBe('Brak uprawnień');
    expect((forbidden as PermissionDeniedError).code).toBe('missing-permissions');

    const limited = await resource.json('GET', '/x').catch((e: unknown) => e);
    expect(limited).toBeInstanceOf(RateLimitError);
    expect((limited as RateLimitError).message).toBe('Limit 20/min.');
    expect((limited as RateLimitError).details).toEqual(['Limit 20/min.']);
  });

  it('returns undefined for empty bodies and wraps non-JSON bodies', async () => {
    const ctx = createContext((_config, index) =>
      index === 0 ? json(204, undefined) : text(200, '<html/>'),
    );
    authenticate(ctx);
    const resource = new TestResource(ctx.context);

    await expect(resource.json('GET', '/empty')).resolves.toBeUndefined();
    await expect(resource.json('GET', '/html')).rejects.toThrow(KsefError);
  });

  it('requestText asks for XML and returns the body verbatim', async () => {
    const ctx = createContext(() => text(200, '<Upo/>'));
    authenticate(ctx);
    const resource = new TestResource(ctx.context);

    await expect(resource.text('/upo')).resolves.toBe('<Upo/>');
    expect(ctx.http.requests[0].headers?.Accept).toBe('application/xml');
  });

  it('passes absolute URLs through unchanged', async () => {
    const ctx = createContext(() => text(200, 'x'));
    const resource = new TestResource(ctx.context);

    await resource.text('https://storage.example/upo.xml?sig=1', { auth: { type: 'none' } });
    expect(ctx.http.requests[0].url).toBe('https://storage.example/upo.xml?sig=1');
  });
});
