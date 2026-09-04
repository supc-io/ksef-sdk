import {
  createCipheriv,
  createDecipheriv,
  createHash,
  publicEncrypt,
  randomBytes,
  constants,
  X509Certificate,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';

export interface SymmetricKeyMaterial {
  /** 32-byte AES-256 key. */
  key: Buffer;
  /** 16-byte initialization vector. */
  iv: Buffer;
}

/** Generates a fresh AES-256 key and IV for an interactive or batch session. */
export function generateSymmetricKey(): SymmetricKeyMaterial {
  return { key: randomBytes(32), iv: randomBytes(16) };
}

/** AES-256-CBC with PKCS#7 padding, as required for invoice payloads. */
export function encryptAes256Cbc(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

export function decryptAes256Cbc(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * RSA-OAEP with SHA-256 (and MGF1-SHA-256), used to encrypt the session's
 * symmetric key with the Ministry of Finance public key.
 *
 * @param publicKey - X.509 certificate (DER, base64-encoded as returned by
 *   `GET /security/public-key-certificates`), a PEM certificate, or a KeyObject.
 */
export function encryptRsaOaepSha256(data: Buffer, publicKey: string | KeyObject): Buffer {
  const key = typeof publicKey === 'string' ? toPublicKey(publicKey) : publicKey;
  return publicEncrypt(
    {
      key,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data,
  );
}

export function sha256Base64(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('base64');
}

function toPublicKey(certificate: string): KeyObject {
  const der = certificate.includes('-----BEGIN')
    ? Buffer.from(certificate)
    : Buffer.from(certificate, 'base64');
  return new X509Certificate(der).publicKey;
}
