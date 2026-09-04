import { describe, it, expect } from 'vitest';
import { KsefClientBuilder, Mode, FormCodes } from '../../src/index.js';
import { readFileSync } from 'node:fs';

/**
 * Integration test against https://api-test.ksef.mf.gov.pl/v2
 *
 * Required environment variables:
 *   KSEF_TEST_CERT_PATH  - path to a test .p12 certificate (see
 *                          https://github.com/CIRFMF/ksef-api/blob/main/auth/testowe-certyfikaty-i-podpisy-xades.md)
 *   KSEF_TEST_CERT_PASS  - certificate password (may be empty)
 *   KSEF_TEST_NIP        - NIP of the context the certificate is authorised for
 *   KSEF_TEST_INVOICE    - path to an FA(3) invoice XML for that NIP (optional; without it only auth + session are tested)
 */
const CERT_PATH = process.env.KSEF_TEST_CERT_PATH;
const CERT_PASS = process.env.KSEF_TEST_CERT_PASS;
const NIP = process.env.KSEF_TEST_NIP;
const INVOICE_PATH = process.env.KSEF_TEST_INVOICE;

const canRun = Boolean(CERT_PATH && CERT_PASS !== undefined && NIP);

async function waitFor<T>(
  poll: () => Promise<T>,
  done: (value: T) => boolean,
  attempts = 30,
  intervalMs = 2000,
): Promise<T> {
  let last!: T;
  for (let i = 0; i < attempts; i++) {
    last = await poll();
    if (done(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last;
}

describe.skipIf(!canRun)('KSeF API 2.0 integration: authenticate → session → invoice → UPO', () => {
  it('runs the full online flow on TEST', async () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(readFileSync(CERT_PATH!).toString('base64'), CERT_PASS!)
      .identifier(NIP!)
      .formCode(FormCodes.FA3)
      .build();

    const auth = await client.auth.authenticate();
    expect(auth.accessToken.token).toBeTruthy();
    expect(client.isAuthenticated).toBe(true);

    const session = await client.sessions.open();
    expect(session.referenceNumber).toHaveLength(36);
    expect(client.isSessionActive).toBe(true);

    if (INVOICE_PATH) {
      const sent = await client.invoices.send({ xml: readFileSync(INVOICE_PATH, 'utf-8') });
      expect(sent.referenceNumber).toHaveLength(36);

      const status = await waitFor(
        () => client.invoices.status({ invoiceReferenceNumber: sent.referenceNumber }),
        (s) => s.status.code !== 100 && s.status.code !== 150,
      );
      expect(status.status.code).toBe(200);
      expect(status.ksefNumber).toBeTruthy();

      const upo = await client.upo.forInvoice({ invoiceReferenceNumber: sent.referenceNumber });
      expect(upo).toContain('<');
    }

    await client.sessions.close({ referenceNumber: session.referenceNumber });
    expect(client.isSessionActive).toBe(false);

    const closed = await waitFor(
      () => client.sessions.status({ referenceNumber: session.referenceNumber }),
      (s) => s.status.code !== 100 && s.status.code !== 170,
    );
    expect([200, 440, 445]).toContain(closed.status.code);

    await client.auth.revoke();
    expect(client.isAuthenticated).toBe(false);
  }, 180_000);
});
