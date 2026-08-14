import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicesResource } from '../../../src/resources/invoices.js';
import { SessionManager } from '../../../src/session-manager.js';
import { KsefApiError, NotFoundError } from '../../../src/errors/index.js';
import type { HttpClient, HttpRequestConfig, HttpResponse } from '../../../src/http/http-client.js';
import type { ClientConfig } from '../../../src/types/common.js';
import { Mode } from '../../../src/types/common.js';

function createMockHttpClient(handler: (config: HttpRequestConfig) => HttpResponse): HttpClient {
  return {
    async request(config: HttpRequestConfig): Promise<HttpResponse> {
      return handler(config);
    },
  };
}

const baseConfig: ClientConfig = {
  mode: Mode.Test,
  baseUrl: 'https://ksef-test.mf.gov.pl/api',
  identifier: '1234563218',
  certificateBase64: '',
  certificatePassword: '',
  timeout: 30000,
  maxRetries: 0,
};

describe('InvoicesResource', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    sessionManager.setSession('test-token-123', 'ref-001');
  });

  it('send() sends invoice and returns result', async () => {
    const mockResponse = {
      elementReferenceNumber: 'elem-001',
      referenceNumber: 'ref-002',
      processingCode: 200,
      processingDescription: 'OK',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const http = createMockHttpClient((config) => {
      expect(config.method).toBe('PUT');
      expect(config.url).toContain('/online/Invoice/Send');
      expect(config.headers?.SessionToken).toBe('test-token-123');
      return { status: 200, headers: {}, body: JSON.stringify(mockResponse) };
    });

    const invoices = new InvoicesResource(http, baseConfig, sessionManager);
    const result = await invoices.send({ xml: '<Invoice/>' });

    expect(result.elementReferenceNumber).toBe('elem-001');
    expect(result.processingCode).toBe(200);
  });

  it('status() returns invoice status', async () => {
    const mockResponse = {
      processingCode: 200,
      processingDescription: 'OK',
      elementReferenceNumber: 'elem-001',
      invoiceStatus: {
        invoiceNumber: 'FV/2024/001',
        ksefReferenceNumber: 'ksef-ref-001',
        acquisitionTimestamp: '2024-01-01T00:00:00Z',
      },
    };

    const http = createMockHttpClient((config) => {
      expect(config.method).toBe('GET');
      expect(config.url).toContain('/online/Invoice/Status/elem-001');
      return { status: 200, headers: {}, body: JSON.stringify(mockResponse) };
    });

    const invoices = new InvoicesResource(http, baseConfig, sessionManager);
    const result = await invoices.status({ invoiceElementReferenceNumber: 'elem-001' });

    expect(result.invoiceStatus?.invoiceNumber).toBe('FV/2024/001');
  });

  it('throws NotFoundError on 404', async () => {
    const http = createMockHttpClient(() => ({
      status: 404,
      headers: {},
      body: JSON.stringify({ message: 'Invoice not found' }),
    }));

    const invoices = new InvoicesResource(http, baseConfig, sessionManager);
    await expect(
      invoices.status({ invoiceElementReferenceNumber: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws when no session is active', async () => {
    sessionManager.clear();
    const http = createMockHttpClient(() => ({ status: 200, headers: {}, body: '{}' }));
    const invoices = new InvoicesResource(http, baseConfig, sessionManager);

    await expect(invoices.send({ xml: '<Invoice/>' })).rejects.toThrow(
      'No active session',
    );
  });

  it('query() sends search criteria', async () => {
    const mockResponse = {
      referenceNumber: 'ref-003',
      processingCode: 200,
      processingDescription: 'OK',
      numberOfElements: 1,
      pageSize: 10,
      pageOffset: 0,
      invoiceHeaderList: [],
    };

    const http = createMockHttpClient((config) => {
      expect(config.method).toBe('POST');
      expect(config.url).toContain('/online/Query/Invoice/Sync');
      const body = JSON.parse(config.body as string);
      expect(body.queryCriteria.subjectType).toBe('subject1');
      return { status: 200, headers: {}, body: JSON.stringify(mockResponse) };
    });

    const invoices = new InvoicesResource(http, baseConfig, sessionManager);
    const result = await invoices.query({ subjectType: 'subject1' });

    expect(result.numberOfElements).toBe(1);
  });

  it('download() returns XML string', async () => {
    const invoiceXml = '<Invoice><Number>FV/001</Number></Invoice>';
    const http = createMockHttpClient(() => ({
      status: 200,
      headers: {},
      body: invoiceXml,
    }));

    const invoices = new InvoicesResource(http, baseConfig, sessionManager);
    const result = await invoices.download({ ksefReferenceNumber: 'ksef-ref-001' });

    expect(result).toBe(invoiceXml);
  });
});
