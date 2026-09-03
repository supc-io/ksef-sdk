import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parsePkcs12 } from '../../../src/utils/certificate.js';
import { ConfigurationError } from '../../../src/errors/index.js';
import { createTestKeyMaterial, hasOpenssl, opensslMajorVersion } from '../../helpers/openssl.js';
import type { TestKeyMaterial } from '../../helpers/openssl.js';

function ksefTempDirs(): string[] {
  return readdirSync(tmpdir()).filter((name) => /^ksef-[^x]/.test(name));
}

describe.skipIf(!hasOpenssl())('parsePkcs12', () => {
  let material: TestKeyMaterial;

  beforeAll(() => {
    material = createTestKeyMaterial({ password: 'S3cret,Pass word' });
  });

  afterAll(() => {
    material.cleanup();
  });

  it('extracts the private key and certificate from a PKCS#12 bundle', () => {
    const parsed = parsePkcs12(material.p12Base64, material.password);

    expect(parsed.privateKeyPem).toMatch(/^-----BEGIN (RSA )?PRIVATE KEY-----/);
    expect(parsed.privateKeyPem).toMatch(/-----END (RSA )?PRIVATE KEY-----$/);
    expect(parsed.certificatePem).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(parsed.certificatePem).toMatch(/-----END CERTIFICATE-----$/);
  });

  it('removes its temporary directory afterwards', () => {
    const before = ksefTempDirs().length;
    parsePkcs12(material.p12Base64, material.password);
    expect(ksefTempDirs().length).toBe(before);
  });

  it('throws ConfigurationError on a wrong password without leaking the password', () => {
    let caught: unknown;
    try {
      parsePkcs12(material.p12Base64, 'wrong-password-xyz');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConfigurationError);
    const message = (caught as Error).message;
    expect(message).toMatch(/PKCS#12/);
    expect(message).not.toContain('wrong-password-xyz');
    expect(message).not.toContain(material.password);
  });

  it('throws ConfigurationError for garbage input', () => {
    expect(() => parsePkcs12(Buffer.from('not a p12').toString('base64'), 'x')).toThrow(
      ConfigurationError,
    );
  });

  it('accepts an empty password', () => {
    const empty = createTestKeyMaterial({ password: '' });
    try {
      const parsed = parsePkcs12(empty.p12Base64, '');
      expect(parsed.certificatePem).toContain('BEGIN CERTIFICATE');
    } finally {
      empty.cleanup();
    }
  });

  it.skipIf(opensslMajorVersion() < 3)(
    'parses legacy (RC2/3DES) PKCS#12 bundles on OpenSSL 3',
    () => {
      const legacy = createTestKeyMaterial({ password: 'legacy', legacy: true });
      try {
        const parsed = parsePkcs12(legacy.p12Base64, 'legacy');
        expect(parsed.privateKeyPem).toContain('PRIVATE KEY');
      } finally {
        legacy.cleanup();
      }
    },
  );
});
