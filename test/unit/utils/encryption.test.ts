import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { privateDecrypt, constants, X509Certificate } from 'node:crypto';
import {
  generateSymmetricKey,
  encryptAes256Cbc,
  decryptAes256Cbc,
  encryptRsaOaepSha256,
  sha256Base64,
} from '../../../src/utils/encryption.js';
import { createTestKeyMaterial, hasOpenssl } from '../../helpers/openssl.js';
import type { TestKeyMaterial } from '../../helpers/openssl.js';

describe('generateSymmetricKey', () => {
  it('returns a 32-byte key and a 16-byte IV', () => {
    const { key, iv } = generateSymmetricKey();
    expect(key).toHaveLength(32);
    expect(iv).toHaveLength(16);
    expect(generateSymmetricKey().key.equals(key)).toBe(false);
  });
});

describe('AES-256-CBC', () => {
  it('round-trips with PKCS#7 padding', () => {
    const { key, iv } = generateSymmetricKey();
    const plain = Buffer.from('<Faktura>ąęś</Faktura>', 'utf-8');
    const encrypted = encryptAes256Cbc(plain, key, iv);

    expect(encrypted.length % 16).toBe(0);
    expect(encrypted.length).toBeGreaterThan(plain.length);
    expect(decryptAes256Cbc(encrypted, key, iv)).toEqual(plain);
  });

  it('pads a block-aligned input with a full extra block', () => {
    const { key, iv } = generateSymmetricKey();
    const encrypted = encryptAes256Cbc(Buffer.alloc(32, 1), key, iv);
    expect(encrypted).toHaveLength(48);
  });
});

describe('sha256Base64', () => {
  it('matches a known vector', () => {
    expect(sha256Base64('abc')).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
    expect(sha256Base64(Buffer.from('abc'))).toHaveLength(44);
  });
});

describe.skipIf(!hasOpenssl())('encryptRsaOaepSha256', () => {
  let material: TestKeyMaterial;

  beforeAll(() => {
    material = createTestKeyMaterial();
  });

  afterAll(() => {
    material.cleanup();
  });

  function decrypt(encrypted: Buffer): Buffer {
    return privateDecrypt(
      { key: material.keyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      encrypted,
    );
  }

  it('encrypts with a base64 DER certificate (as served by /security/public-key-certificates)', () => {
    const der = new X509Certificate(material.certPem).raw.toString('base64');
    const { key } = generateSymmetricKey();
    const encrypted = encryptRsaOaepSha256(key, der);

    expect(encrypted).toHaveLength(256);
    expect(decrypt(encrypted)).toEqual(key);
  });

  it('accepts a PEM certificate and a KeyObject', () => {
    const { key } = generateSymmetricKey();
    expect(decrypt(encryptRsaOaepSha256(key, material.certPem))).toEqual(key);
    expect(
      decrypt(encryptRsaOaepSha256(key, new X509Certificate(material.certPem).publicKey)),
    ).toEqual(key);
  });
});
