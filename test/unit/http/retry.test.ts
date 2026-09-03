import { describe, it, expect } from 'vitest';
import { RetryHttpClient } from '../../../src/http/retry.js';
import type { HttpClient, HttpRequestConfig, HttpResponse } from '../../../src/http/http-client.js';
import { ConnectionError } from '../../../src/errors/index.js';

function mockHttpClient(responses: Array<HttpResponse | Error>): HttpClient {
  let callIndex = 0;
  return {
    async request(_config: HttpRequestConfig): Promise<HttpResponse> {
      const resp = responses[callIndex++];
      if (resp instanceof Error) throw resp;
      return resp;
    },
  };
}

function ok(body = '{}'): HttpResponse {
  return { status: 200, headers: {}, body };
}

function serverError(): HttpResponse {
  return { status: 500, headers: {}, body: 'Internal Server Error' };
}

function rateLimited(): HttpResponse {
  return { status: 429, headers: { 'retry-after': '0' }, body: 'Too Many Requests' };
}

describe('RetryHttpClient', () => {
  it('returns response on first success', async () => {
    const inner = mockHttpClient([ok('{"ok":true}')]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request({ method: 'GET', url: '/test' });
    expect(response.status).toBe(200);
    expect(response.body).toBe('{"ok":true}');
  });

  it('retries on 500 and succeeds', async () => {
    const inner = mockHttpClient([serverError(), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request({ method: 'GET', url: '/test' });
    expect(response.status).toBe(200);
  });

  it('retries on 429 and succeeds', async () => {
    const inner = mockHttpClient([rateLimited(), ok()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request({ method: 'GET', url: '/test' });
    expect(response.status).toBe(200);
  });

  it('throws ConnectionError after all retries exhausted on network error', async () => {
    const inner = mockHttpClient([
      new Error('ECONNREFUSED'),
      new Error('ECONNREFUSED'),
      new Error('ECONNREFUSED'),
    ]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    await expect(client.request({ method: 'GET', url: '/test' })).rejects.toThrow(ConnectionError);
  });

  it('returns 500 response after retries exhausted', async () => {
    const inner = mockHttpClient([serverError(), serverError(), serverError()]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request({ method: 'GET', url: '/test' });
    expect(response.status).toBe(500);
  });

  it('does not retry 4xx errors (except 429)', async () => {
    const resp: HttpResponse = { status: 400, headers: {}, body: 'Bad Request' };
    const inner = mockHttpClient([resp]);
    const client = new RetryHttpClient(inner, { maxRetries: 2, baseDelayMs: 1 });

    const response = await client.request({ method: 'GET', url: '/test' });
    expect(response.status).toBe(400);
  });
});
