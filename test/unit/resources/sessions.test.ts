import { describe, it, expect, vi } from 'vitest';
import { SessionsResource } from '../../../src/resources/sessions.js';
import { AuthResource } from '../../../src/resources/auth.js';
import { SessionManager } from '../../../src/session-manager.js';
import { AuthenticationError, SessionError } from '../../../src/errors/index.js';
import type { HttpClient, HttpRequestConfig, HttpResponse } from '../../../src/http/http-client.js';
import type { ClientConfig } from '../../../src/types/common.js';
import { Mode } from '../../../src/types/common.js';

const baseConfig: ClientConfig = {
  mode: Mode.Test,
  baseUrl: 'https://ksef-test.mf.gov.pl/api',
  identifier: '1234563218',
  certificateBase64: '',
  certificatePassword: '',
  timeout: 30000,
  maxRetries: 0,
};

function mockClient(handler: (config: HttpRequestConfig) => HttpResponse): HttpClient {
  return {
    async request(config: HttpRequestConfig): Promise<HttpResponse> {
      return handler(config);
    },
  };
}

function json(status: number, body: unknown): HttpResponse {
  return { status, headers: {}, body: JSON.stringify(body) };
}

function build(handler: (config: HttpRequestConfig) => HttpResponse) {
  const http = mockClient(handler);
  const sessionManager = new SessionManager();
  const auth = new AuthResource(http, baseConfig, sessionManager);
  vi.spyOn(auth, 'initSigned').mockResolvedValue({ referenceNumber: 'ref-1', timestamp: 't' });
  const sessions = new SessionsResource(http, baseConfig, sessionManager, auth);
  return { sessions, sessionManager, auth };
}

describe('SessionsResource.init', () => {
  it('activates the session when the status carries a token', async () => {
    const { sessions, sessionManager } = build((config) => {
      expect(config.url).toContain('/online/Session/Status/ref-1');
      expect(config.headers?.SessionToken).toBeUndefined();
      return json(200, {
        processingCode: 200,
        processingDescription: 'OK',
        referenceNumber: 'ref-1',
        timestamp: 't',
        sessionToken: { token: 'tok-1' },
      });
    });

    const result = await sessions.init();

    expect(result).toEqual({ referenceNumber: 'ref-1', sessionToken: 'tok-1' });
    expect(sessionManager.isActive).toBe(true);
    expect(sessionManager.requireToken()).toBe('tok-1');
  });

  it('fails loudly instead of activating an empty session when no token is returned', async () => {
    const { sessions, sessionManager } = build(() =>
      json(200, {
        processingCode: 200,
        processingDescription: 'OK',
        referenceNumber: 'ref-1',
        timestamp: 't',
      }),
    );

    await expect(sessions.init()).rejects.toThrow(SessionError);
    await expect(sessions.init()).rejects.toThrow(/did not include a session token/);
    expect(sessionManager.isActive).toBe(false);
  });

  it('throws SessionError when KSeF reports a failed initialisation', async () => {
    const { sessions } = build(() =>
      json(200, {
        processingCode: 430,
        processingDescription: 'Invalid signature',
        referenceNumber: 'ref-1',
        timestamp: 't',
      }),
    );

    await expect(sessions.init()).rejects.toThrow(SessionError);
    await expect(sessions.init()).rejects.toThrow(/Invalid signature \(code: 430\)/);
  });

  it('aborts polling when the caller cancels', async () => {
    const controller = new AbortController();
    const { sessions } = build(() => {
      controller.abort();
      return json(200, {
        processingCode: 100,
        processingDescription: 'Pending',
        referenceNumber: 'ref-1',
        timestamp: 't',
      });
    });

    await expect(sessions.init({ requestOptions: { signal: controller.signal } })).rejects.toThrow(
      /aborted by caller/,
    );
  });
});

describe('SessionsResource.terminate', () => {
  it('clears the session on success', async () => {
    const { sessions, sessionManager } = build(() =>
      json(200, { referenceNumber: 'ref-1', timestamp: 't' }),
    );
    sessionManager.setSession('tok-1', 'ref-1');

    const result = await sessions.terminate();

    expect(result.referenceNumber).toBe('ref-1');
    expect(sessionManager.isActive).toBe(false);
  });

  it('clears the session when KSeF already considers it invalid (401)', async () => {
    const { sessions, sessionManager } = build(() => json(401, { message: 'expired' }));
    sessionManager.setSession('tok-1', 'ref-1');

    await expect(sessions.terminate()).rejects.toThrow(AuthenticationError);
    expect(sessionManager.isActive).toBe(false);
  });
});
