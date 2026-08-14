import { createPublicKey, publicEncrypt, constants } from 'node:crypto';

/**
 * Encrypts a session token using RSA-OAEP with the KSeF public key.
 * KSeF requires token encryption with its public key before sending in InitSigned.
 */
export function encryptToken(token: string, ksefPublicKeyPem: string): string {
  const publicKey = createPublicKey(ksefPublicKeyPem);
  const encrypted = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(token, 'utf-8'),
  );
  return encrypted.toString('base64');
}
