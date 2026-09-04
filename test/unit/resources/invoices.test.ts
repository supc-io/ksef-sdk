import { describe, it, expect } from 'vitest';
import { InvoicesResource } from '../../../src/resources/invoices.js';
import { SessionsResource } from '../../../src/resources/sessions.js';
import { SecurityResource } from '../../../src/resources/security.js';
import { SessionError, ValidationError } from '../../../src/errors/index.js';
import { decryptAes256Cbc } from '../../../src/utils/encryption.js';
import {
  authenticate,
  createContext,
  json,
  openSession,
  router,
  text,
} from '../../helpers/context.js';
import type { Handler } from '../../helpers/context.js';

function build(routes: Record<string, Handler>) {
  const ctx = createContext(router(routes));
  authenticate(ctx);
  const sessions = new SessionsResource(ctx.context, new SecurityResource(ctx.context));
  const invoices = new InvoicesResource(ctx.context, sessions);
  return { ctx, invoices };
}

describe('InvoicesResource', () => {
  it('send() requires an open session', async () => {
    const { ctx, invoices } = build({});
    await expect(invoices.send({ xml: '<Faktura/>' })).rejects.toThrow(SessionError);
    expect(ctx.http.requests).toHaveLength(0);
  });

  it('send() encrypts with the open session key and forwards optional fields', async () => {
    const { ctx, invoices } = build({
      'POST /sessions/online/sess-1/invoices': () => json(202, { referenceNumber: 'inv-9' }),
    });
    const { key, iv } = openSession(ctx, 'sess-1');

    const result = await invoices.send({
      xml: '<Faktura/>',
      offlineMode: true,
      hashOfCorrectedInvoice: 'abc=',
    });

    expect(result.referenceNumber).toBe('inv-9');
    expect(result.sessionReferenceNumber).toBe('sess-1');
    const body = JSON.parse(String(ctx.http.requests[0].body));
    expect(
      decryptAes256Cbc(Buffer.from(body.encryptedInvoiceContent, 'base64'), key, iv).toString(),
    ).toBe('<Faktura/>');
    expect(body.offlineMode).toBe(true);
    expect(body.hashOfCorrectedInvoice).toBe('abc=');
  });

  it('send() surfaces KSeF validation errors (400) as ValidationError', async () => {
    const { ctx, invoices } = build({
      'POST /sessions/online/sess-1/invoices': () =>
        json(400, {
          exception: {
            exceptionDetailList: [
              { exceptionCode: 21301, exceptionDescription: 'Nieprawidłowy skrót', details: ['x'] },
            ],
            referenceNumber: 'err-ref',
          },
        }),
    });
    openSession(ctx, 'sess-1');

    const error = await invoices.send({ xml: '<Faktura/>' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('21301');
    expect((error as ValidationError).requestId).toBe('err-ref');
    expect((error as ValidationError).details).toEqual(['x']);
  });

  it('status() delegates to the session invoice status endpoint', async () => {
    const { ctx, invoices } = build({
      'GET /sessions/sess-1/invoices/inv-1': () =>
        json(200, {
          ordinalNumber: 1,
          referenceNumber: 'inv-1',
          invoiceHash: 'h',
          invoicingDate: 'd',
          status: { code: 150, description: 'Trwa przetwarzanie' },
        }),
      'GET /sessions/sess-2/invoices/inv-2': () =>
        json(200, {
          ordinalNumber: 1,
          referenceNumber: 'inv-2',
          invoiceHash: 'h',
          invoicingDate: 'd',
          status: { code: 200, description: 'OK' },
        }),
    });
    openSession(ctx, 'sess-1');

    expect((await invoices.status({ invoiceReferenceNumber: 'inv-1' })).status.code).toBe(150);
    expect(
      (await invoices.status({ invoiceReferenceNumber: 'inv-2', sessionReferenceNumber: 'sess-2' }))
        .status.code,
    ).toBe(200);
  });

  it('download() returns the invoice XML', async () => {
    const ksefNumber = '1234563218-20260903-ABCDEF-012345-01';
    const { ctx, invoices } = build({
      [`GET /invoices/ksef/${ksefNumber}`]: () => text(200, '<Faktura>x</Faktura>'),
    });

    await expect(invoices.download({ ksefNumber })).resolves.toBe('<Faktura>x</Faktura>');
    expect(ctx.http.requests[0].headers?.Accept).toBe('application/xml');
  });

  it('query() posts filters and puts paging in the query string', async () => {
    const { ctx, invoices } = build({
      'POST /invoices/query/metadata': () =>
        json(200, { hasMore: false, isTruncated: false, invoices: [] }),
    });

    const result = await invoices.query({
      filters: {
        subjectType: 'Subject1',
        dateRange: { dateType: 'Issue', from: '2026-01-01T00:00:00Z' },
      },
      pageSize: 50,
      pageOffset: 2,
      sortOrder: 'Desc',
    });

    expect(result.hasMore).toBe(false);
    const request = ctx.http.requests[0];
    expect(request.url).toBe(
      'https://api-test.ksef.mf.gov.pl/v2/invoices/query/metadata?sortOrder=Desc&pageOffset=2&pageSize=50',
    );
    expect(JSON.parse(String(request.body))).toEqual({
      subjectType: 'Subject1',
      dateRange: { dateType: 'Issue', from: '2026-01-01T00:00:00Z' },
    });
  });
});
