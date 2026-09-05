import { describe, it, expect } from 'vitest';
import { ExportsResource } from '../../../src/resources/exports.js';
import { SessionManager } from '../../../src/session-manager.js';
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

describe('ExportsResource.download', () => {
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x80]);

  it('returns the raw bytes of the export part', async () => {
    const http = mockClient((config) => {
      expect(config.url).toContain('/online/Query/Invoice/Async/Fetch/ref%2F1/part-1');
      expect(config.headers?.Accept).toBe('application/octet-stream');
      return { status: 200, headers: {}, body: bytes.toString('utf-8'), rawBody: bytes };
    });
    const sessionManager = new SessionManager();
    sessionManager.setSession('tok', 'ref');
    const exportsResource = new ExportsResource(http, baseConfig, sessionManager);

    const result = await exportsResource.download({
      referenceNumber: 'ref/1',
      partReferenceNumber: 'part-1',
    });

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(bytes);
  });

  it('falls back to the text body for custom HTTP clients without rawBody', async () => {
    const http = mockClient(() => ({ status: 200, headers: {}, body: 'plain text' }));
    const sessionManager = new SessionManager();
    sessionManager.setSession('tok', 'ref');
    const exportsResource = new ExportsResource(http, baseConfig, sessionManager);

    const result = await exportsResource.download({
      referenceNumber: 'r',
      partReferenceNumber: 'p',
    });

    expect(result.toString('utf-8')).toBe('plain text');
  });
});
