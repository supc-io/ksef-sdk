import { describe, it, expect } from 'vitest';
import { SecurityResource } from '../../../src/resources/security.js';
import { KsefError } from '../../../src/errors/index.js';
import { createContext, json, router, futureDate } from '../../helpers/context.js';

function certificate(usage: string[], validFromOffset = -3_600_000, validToOffset = 3_600_000) {
  return {
    certificate: 'MIIB',
    certificateId: 'id',
    publicKeyId: 'key-id',
    validFrom: futureDate(validFromOffset),
    validTo: futureDate(validToOffset),
    usage,
  };
}

describe('SecurityResource', () => {
  it('picks the currently valid SymmetricKeyEncryption certificate and caches the list', async () => {
    const ctx = createContext(
      router({
        'GET /security/public-key-certificates': () =>
          json(200, [
            certificate(['KsefTokenEncryption']),
            certificate(['SymmetricKeyEncryption'], 3_600_000, 7_200_000),
            { ...certificate(['SymmetricKeyEncryption']), publicKeyId: 'the-one' },
          ]),
      }),
    );
    const security = new SecurityResource(ctx.context);

    const first = await security.symmetricKeyEncryptionCertificate();
    const second = await security.symmetricKeyEncryptionCertificate();

    expect(first.publicKeyId).toBe('the-one');
    expect(second).toBe(first);
    expect(ctx.http.requests).toHaveLength(1);
    expect(ctx.http.requests[0].headers?.Authorization).toBeUndefined();
  });

  it('re-fetches once when the cached list has no usable certificate', async () => {
    const ctx = createContext(
      router({
        'GET /security/public-key-certificates': (_config, index) =>
          json(
            200,
            index === 0
              ? [certificate(['KsefTokenEncryption'])]
              : [certificate(['SymmetricKeyEncryption'])],
          ),
      }),
    );
    const security = new SecurityResource(ctx.context);

    await security.publicKeyCertificates();
    const match = await security.symmetricKeyEncryptionCertificate();

    expect(match.usage).toContain('SymmetricKeyEncryption');
    expect(ctx.http.requests).toHaveLength(2);
  });

  it('throws KsefError when no certificate is usable', async () => {
    const ctx = createContext(
      router({ 'GET /security/public-key-certificates': () => json(200, []) }),
    );
    const security = new SecurityResource(ctx.context);

    await expect(security.symmetricKeyEncryptionCertificate()).rejects.toThrow(KsefError);
  });
});
