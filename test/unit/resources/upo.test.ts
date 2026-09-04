import { describe, it, expect } from 'vitest';
import { UpoResource } from '../../../src/resources/upo.js';
import { NotFoundError } from '../../../src/errors/index.js';
import {
  authenticate,
  createContext,
  json,
  openSession,
  router,
  text,
} from '../../helpers/context.js';

describe('UpoResource', () => {
  it('fetches session, invoice and KSeF-number UPOs as XML', async () => {
    const ctx = createContext(
      router({
        'GET /sessions/sess-1/upo/upo-1': () => text(200, '<SessionUpo/>'),
        'GET /sessions/sess-1/invoices/inv-1/upo': () => text(200, '<InvoiceUpo/>'),
        'GET /sessions/sess-1/invoices/ksef/1234563218-20260903-ABCDEF-012345-01/upo': () =>
          text(200, '<KsefUpo/>'),
      }),
    );
    authenticate(ctx);
    openSession(ctx, 'sess-1');
    const upo = new UpoResource(ctx.context);

    await expect(upo.forSession({ upoReferenceNumber: 'upo-1' })).resolves.toBe('<SessionUpo/>');
    await expect(upo.forInvoice({ invoiceReferenceNumber: 'inv-1' })).resolves.toBe(
      '<InvoiceUpo/>',
    );
    await expect(
      upo.forKsefNumber({ ksefNumber: '1234563218-20260903-ABCDEF-012345-01' }),
    ).resolves.toBe('<KsefUpo/>');
    for (const request of ctx.http.requests) {
      expect(request.headers?.Accept).toBe('application/xml');
      expect(request.headers?.Authorization).toBe('Bearer access-jwt');
    }
  });

  it('download() fetches a pre-signed link without a token', async () => {
    const ctx = createContext((config) =>
      config.url === 'https://blob.example/upo?sig=abc' ? text(200, '<Upo/>') : json(404, {}),
    );
    const upo = new UpoResource(ctx.context);

    await expect(upo.download({ url: 'https://blob.example/upo?sig=abc' })).resolves.toBe('<Upo/>');
    expect(ctx.http.requests[0].headers?.Authorization).toBeUndefined();

    await expect(upo.download({ url: 'https://blob.example/expired' })).rejects.toThrow(
      NotFoundError,
    );
  });
});
