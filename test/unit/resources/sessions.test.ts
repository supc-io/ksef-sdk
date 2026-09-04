import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { privateDecrypt, constants, X509Certificate } from 'node:crypto';
import { SessionsResource } from '../../../src/resources/sessions.js';
import { SecurityResource } from '../../../src/resources/security.js';
import { InvoicesResource } from '../../../src/resources/invoices.js';
import { SessionError } from '../../../src/errors/index.js';
import { FormCodes } from '../../../src/types/common.js';
import { decryptAes256Cbc, sha256Base64 } from '../../../src/utils/encryption.js';
import {
  authenticate,
  createContext,
  futureDate,
  json,
  openSession,
  router,
} from '../../helpers/context.js';
import type { Handler } from '../../helpers/context.js';
import { createTestKeyMaterial, hasOpenssl } from '../../helpers/openssl.js';
import type { TestKeyMaterial } from '../../helpers/openssl.js';

const SESSION_REF = '20260903-SO-0000000001-0000000001-01';

function build(routes: Record<string, Handler>) {
  const ctx = createContext(router(routes));
  authenticate(ctx);
  const security = new SecurityResource(ctx.context);
  const sessions = new SessionsResource(ctx.context, security);
  const invoices = new InvoicesResource(ctx.context, sessions);
  return { ctx, sessions, invoices };
}

describe.skipIf(!hasOpenssl())('SessionsResource.open + InvoicesResource.send', () => {
  let material: TestKeyMaterial;

  beforeAll(() => {
    material = createTestKeyMaterial();
  });

  afterAll(() => {
    material.cleanup();
  });

  it('encrypts a fresh AES key with the MF certificate and remembers the session', async () => {
    const der = new X509Certificate(material.certPem).raw.toString('base64');
    const { ctx, sessions, invoices } = build({
      'GET /security/public-key-certificates': () =>
        json(200, [
          {
            certificate: der,
            certificateId: 'cert-1',
            publicKeyId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            validFrom: futureDate(-1000),
            validTo: futureDate(),
            usage: ['SymmetricKeyEncryption'],
          },
        ]),
      'POST /sessions/online': () =>
        json(201, { referenceNumber: SESSION_REF, validUntil: futureDate() }),
      [`POST /sessions/online/${SESSION_REF}/invoices`]: () =>
        json(202, { referenceNumber: 'inv-ref-1' }),
    });

    const opened = await sessions.open();

    expect(opened).toEqual({
      referenceNumber: SESSION_REF,
      validUntil: expect.any(String),
      formCode: FormCodes.FA3,
    });
    expect(ctx.session.isActive).toBe(true);
    expect(sessions.current?.referenceNumber).toBe(SESSION_REF);

    const openRequest = ctx.http.requests.find((r) => r.url.endsWith('/sessions/online'))!;
    expect(openRequest.headers?.Authorization).toBe('Bearer access-jwt');
    const body = JSON.parse(String(openRequest.body));
    expect(body.formCode).toEqual({ systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' });
    expect(body.encryption.publicKeyId).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    const iv = Buffer.from(body.encryption.initializationVector, 'base64');
    expect(iv).toHaveLength(16);
    const key = privateDecrypt(
      { key: material.keyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(body.encryption.encryptedSymmetricKey, 'base64'),
    );
    expect(key).toHaveLength(32);
    expect(key.equals(ctx.session.requireSession().symmetricKey)).toBe(true);

    // An invoice sent afterwards must be encrypted with exactly that key and IV.
    const xml = '<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/"><Naglowek/></Faktura>';
    const sent = await invoices.send({ xml });

    expect(sent).toEqual({
      referenceNumber: 'inv-ref-1',
      sessionReferenceNumber: SESSION_REF,
      invoiceHash: sha256Base64(xml),
    });
    const sendRequest = ctx.http.requests.at(-1)!;
    const sendBody = JSON.parse(String(sendRequest.body));
    const encrypted = Buffer.from(sendBody.encryptedInvoiceContent, 'base64');
    expect(decryptAes256Cbc(encrypted, key, iv).toString('utf-8')).toBe(xml);
    expect(sendBody.invoiceHash).toBe(sha256Base64(xml));
    expect(sendBody.invoiceSize).toBe(Buffer.byteLength(xml));
    expect(sendBody.encryptedInvoiceHash).toBe(sha256Base64(encrypted));
    expect(sendBody.encryptedInvoiceSize).toBe(encrypted.length);
    expect(sendBody.offlineMode).toBe(false);
    expect(sendBody).not.toHaveProperty('hashOfCorrectedInvoice');
  });

  it('honours a per-call formCode', async () => {
    const der = new X509Certificate(material.certPem).raw.toString('base64');
    const { ctx, sessions } = build({
      'GET /security/public-key-certificates': () =>
        json(200, [
          {
            certificate: der,
            certificateId: 'c',
            publicKeyId: 'k',
            validFrom: futureDate(-1),
            validTo: futureDate(),
            usage: ['SymmetricKeyEncryption'],
          },
        ]),
      'POST /sessions/online': () =>
        json(201, { referenceNumber: SESSION_REF, validUntil: futureDate() }),
    });

    const opened = await sessions.open({ formCode: FormCodes.FA2 });

    expect(opened.formCode).toEqual(FormCodes.FA2);
    expect(JSON.parse(String(ctx.http.requests.at(-1)!.body)).formCode.systemCode).toBe('FA (2)');
  });
});

describe('SessionsResource status/invoices/close', () => {
  it('reads the status of the current session by default', async () => {
    const { ctx, sessions } = build({
      [`GET /sessions/${SESSION_REF}`]: () =>
        json(200, {
          status: { code: 100, description: 'Sesja interaktywna otwarta' },
          dateCreated: 'd',
          dateUpdated: 'd',
        }),
      'GET /sessions/other-ref': () =>
        json(200, {
          status: { code: 170, description: 'zamknięta' },
          dateCreated: 'd',
          dateUpdated: 'd',
        }),
    });
    openSession(ctx, SESSION_REF);

    const current = await sessions.status();
    const other = await sessions.status({ referenceNumber: 'other-ref' });

    expect(current.status.code).toBe(100);
    expect(other.status.code).toBe(170);
  });

  it('throws SessionError when no session is open and no reference number is given', async () => {
    const { ctx, sessions } = build({});
    await expect(sessions.status()).rejects.toThrow(SessionError);
    expect(ctx.http.requests).toHaveLength(0);
  });

  it('lists session invoices with pageSize and continuation token', async () => {
    const { ctx, sessions } = build({
      [`GET /sessions/${SESSION_REF}/invoices`]: () =>
        json(200, {
          continuationToken: 'next',
          invoices: [
            {
              ordinalNumber: 1,
              referenceNumber: 'inv-1',
              invoiceHash: 'h',
              invoicingDate: 'd',
              status: { code: 200, description: 'OK' },
            },
          ],
        }),
    });
    openSession(ctx, SESSION_REF);

    const page = await sessions.invoices({ pageSize: 50, continuationToken: 'abc' });

    expect(page.continuationToken).toBe('next');
    expect(page.invoices[0].referenceNumber).toBe('inv-1');
    expect(ctx.http.requests[0].url).toBe(
      `https://api-test.ksef.mf.gov.pl/v2/sessions/${SESSION_REF}/invoices?pageSize=50`,
    );
    expect(ctx.http.requests[0].headers?.['x-continuation-token']).toBe('abc');
  });

  it('reads a single invoice status', async () => {
    const { ctx, sessions } = build({
      [`GET /sessions/${SESSION_REF}/invoices/inv-1`]: () =>
        json(200, {
          ordinalNumber: 1,
          referenceNumber: 'inv-1',
          ksefNumber: '1234563218-20260903-ABCDEF-012345-01',
          invoiceHash: 'h',
          invoicingDate: 'd',
          status: { code: 200, description: 'OK' },
        }),
    });
    openSession(ctx, SESSION_REF);

    const status = await sessions.invoiceStatus({ invoiceReferenceNumber: 'inv-1' });

    expect(status.ksefNumber).toBe('1234563218-20260903-ABCDEF-012345-01');
  });

  it('close() posts to /sessions/online/{ref}/close and forgets the current session', async () => {
    const { ctx, sessions } = build({
      [`POST /sessions/online/${SESSION_REF}/close`]: () => json(204, undefined),
      'POST /sessions/online/other/close': () => json(204, undefined),
    });
    openSession(ctx, SESSION_REF);

    await sessions.close({ referenceNumber: 'other' });
    expect(ctx.session.isActive).toBe(true);

    await sessions.close();
    expect(ctx.session.isActive).toBe(false);
    expect(ctx.http.requests.at(-1)!.method).toBe('POST');
  });
});
