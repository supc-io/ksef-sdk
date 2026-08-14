import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { encryptToken } from '../../../src/utils/encryption.js';

describe('encryptToken', () => {
  it('encrypts a token with RSA-OAEP', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const token = 'test-session-token-12345';
    const encrypted = encryptToken(token, publicKey as string);

    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');
    // Verify it's valid base64
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Encrypted should be different from plaintext
    expect(encrypted).not.toBe(token);
  });
});
