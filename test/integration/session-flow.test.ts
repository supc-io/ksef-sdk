import { describe, it, expect } from 'vitest';
import { KsefClientBuilder, Mode } from '../../src/index.js';
import { readFileSync } from 'node:fs';

/**
 * Integration tests against ksef-test.mf.gov.pl
 *
 * Required environment variables:
 *   KSEF_TEST_CERT_PATH  - path to test .p12 certificate
 *   KSEF_TEST_CERT_PASS  - certificate password
 *   KSEF_TEST_NIP        - NIP associated with the test certificate
 */
const CERT_PATH = process.env.KSEF_TEST_CERT_PATH;
const CERT_PASS = process.env.KSEF_TEST_CERT_PASS;
const NIP = process.env.KSEF_TEST_NIP;

const canRun = CERT_PATH && CERT_PASS && NIP;

describe.skipIf(!canRun)('KSeF Integration: session flow', () => {
  it('init → send invoice → get UPO → terminate', async () => {
    const certBase64 = readFileSync(CERT_PATH!).toString('base64');

    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(certBase64, CERT_PASS!)
      .identifier(NIP!)
      .build();

    // Init session
    const session = await client.sessions.init();
    expect(session.sessionToken).toBeTruthy();
    expect(session.referenceNumber).toBeTruthy();

    // Send a test invoice
    const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <!-- minimal test invoice XML -->
</Faktura>`;

    const sendResult = await client.invoices.send({ xml: invoiceXml });
    expect(sendResult.elementReferenceNumber).toBeTruthy();

    // Get UPO
    const upo = await client.upo.get({
      referenceNumber: sendResult.referenceNumber,
    });
    expect(upo.upo).toBeTruthy();

    // Terminate session
    const termResult = await client.sessions.terminate();
    expect(termResult.referenceNumber).toBeTruthy();
    expect(client.isSessionActive).toBe(false);
  }, 120000);
});
