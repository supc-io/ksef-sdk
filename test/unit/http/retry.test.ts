import { describe, it, expect } from 'vitest';
import { RetryHttpClient, parseRetryAfter, calculateDelay } from '../../../src/http/retry.js';
import type {
  HttpClient,
  HttpMethod,
  HttpRequestConfig,
  HttpResponse,
} from '../../../src/http/http-client.js';
import { ConnectionError } from '../../../src/errors/index.js';

function mockHttpClient(responses: Array<HttpResponse | Error>): HttpClient & { calls: number } {
  let callIndex = 0;
  const client = {
    calls: 0,
    async request(_config: HttpRequestConfig): Promise<HttpResponse> {
      client.calls++;
      const resp = responses[callIndex++];
      if (resp === undefined) throw new Error('mock exhausted');
      if (resp instanceof Error) throw resp;
      return resp;
    },
  };
  return client;
}

function ok(body = '{}'): HttpResponse {
  return { status: 200, headers: {}, body };
}

function serverError(status = 500): HttpResponse {
  return { status, headers: {}, body: 'Server Error' };
}

function rateLimited(headers: Record<string, string> = { 'retry-after': '0' }): HttpResponse {
  return { status: 429, headers, body: 'Too Many Requests' };
}

function req(
  method: HttpMethod = 'GET',
  extra: Partial<HttpRequestConfig> = {},
): HttpRequestConfig {
  return { method, url: '/test', ...extra };
}

describe('RetryHttpClient', () => {
  it('returns response on first success', async () => {
    const inner = mockHttpClient([ok('{"ok":true}')]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req());
    expect(response.status).toBe(200);
    expect(response.body).toBe('{"ok":true}');
  });

  it('retries GET on 500 and succeeds', async () => {
    const inner = mockHttpClient([serverError(), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req());
    expect(response.status).toBe(200);
    expect(inner.calls).toBe(2);
  });

  it('retries on 429 and succeeds', async () => {
    const inner = mockHttpClient([rateLimited(), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req());
    expect(response.status).toBe(200);
  });

  it('retries 429 for non-idempotent methods too', async () => {
    const inner = mockHttpClient([rateLimited(), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req('PUT'));
    expect(response.status).toBe(200);
    expect(inner.calls).toBe(2);
  });

  it('retries 503 for non-idempotent methods', async () => {
    const inner = mockHttpClient([serverError(503), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req('POST'));
    expect(response.status).toBe(200);
    expect(inner.calls).toBe(2);
  });

  it('does not replay PUT/POST after a 500 (request may have been processed)', async () => {
    const inner = mockHttpClient([serverError(), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req('PUT'));
    expect(response.status).toBe(500);
    expect(inner.calls).toBe(1);
  });

  it('does not replay PUT/POST after a transport error', async () => {
    const inner = mockHttpClient([new ConnectionError('Request timed out after 10ms'), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    await expect(client.request(req('POST'))).rejects.toThrow('Request timed out after 10ms');
    expect(inner.calls).toBe(1);
  });

  it('throws ConnectionError after all retries exhausted on network error', async () => {
    const inner = mockHttpClient([
      new Error('ECONNREFUSED'),
      new Error('ECONNREFUSED'),
      new Error('ECONNREFUSED'),
    ]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    await expect(client.request(req())).rejects.toThrow(ConnectionError);
    await expect(
      new RetryHttpClient(mockHttpClient([new Error('ECONNREFUSED')]), { maxRetries: 0 }).request(
        req(),
      ),
    ).rejects.toThrow(/Network error: ECONNREFUSED/);
  });

  it('wraps a plain Error from a custom client into ConnectionError', async () => {
    const inner = mockHttpClient([new Error('boom')]);
    const client = new RetryHttpClient(inner, { maxRetries: 0 });

    const error = await client.request(req()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConnectionError);
    expect((error as ConnectionError).cause?.message).toBe('boom');
  });

  it('returns 500 response after retries exhausted', async () => {
    const inner = mockHttpClient([serverError(), serverError(), serverError()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req());
    expect(response.status).toBe(500);
  });

  it('does not retry 4xx errors (except 429)', async () => {
    const resp: HttpResponse = { status: 400, headers: {}, body: 'Bad Request' };
    const inner = mockHttpClient([resp]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request(req());
    expect(response.status).toBe(400);
  });

  it('caps Retry-After at maxDelayMs', async () => {
    const inner = mockHttpClient([rateLimited({ 'Retry-After': '3600' }), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5 });

    const started = Date.now();
    const response = await client.request(req());
    expect(response.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('falls back to backoff when Retry-After is unparsable', async () => {
    const inner = mockHttpClient([rateLimited({ 'retry-after': 'soon' }), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5 });

    const response = await client.request(req());
    expect(response.status).toBe(200);
  });

  it('stops retrying once the caller aborts', async () => {
    const controller = new AbortController();
    const inner: HttpClient = {
      async request() {
        controller.abort();
        return serverError();
      },
    };
    const client = new RetryHttpClient(inner, { maxRetries: 3, baseDelayMs: 1 });

    await expect(client.request(req('GET', { signal: controller.signal }))).rejects.toThrow(
      /aborted by caller/,
    );
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const inner = mockHttpClient([ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 3, baseDelayMs: 1 });

    await expect(client.request(req('GET', { signal: controller.signal }))).rejects.toThrow(
      ConnectionError,
    );
    expect(inner.calls).toBe(0);
  });
});

describe('parseRetryAfter', () => {
  it('parses delay-seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter(' 10 ')).toBe(10000);
  });

  it('parses HTTP-date relative to now', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:05 GMT', now)).toBe(5000);
    expect(parseRetryAfter('Wed, 31 Dec 2025 00:00:00 GMT', now)).toBe(0);
  });

  it('returns undefined for missing or invalid values', () => {
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('not-a-date')).toBeUndefined();
  });
});

describe('calculateDelay', () => {
  it('grows exponentially with ±10% jitter and respects the cap', () => {
    for (let i = 0; i < 50; i++) {
      expect(calculateDelay(0, 500, 30000)).toBeGreaterThanOrEqual(450);
      expect(calculateDelay(0, 500, 30000)).toBeLessThanOrEqual(550);
      expect(calculateDelay(2, 500, 30000)).toBeGreaterThanOrEqual(1800);
      expect(calculateDelay(2, 500, 30000)).toBeLessThanOrEqual(2200);
      expect(calculateDelay(10, 500, 30000)).toBe(30000);
    }
  });
});
