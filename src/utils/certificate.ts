import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface ParsedCertificate {
  privateKeyPem: string;
  certificatePem: string;
}

/**
 * Parses a PKCS#12 (.p12/.pfx) file and extracts the private key and certificate.
 * Uses openssl CLI which is available on all platforms where KSeF integration is used.
 *
 * @param p12Base64 - Base64-encoded PKCS#12 file content
 * @param password - Password for the PKCS#12 file
 */
export function parsePkcs12(p12Base64: string, password: string): ParsedCertificate {
  const tempDir = mkdtempSync(join(tmpdir(), 'ksef-'));
  const p12Path = join(tempDir, 'cert.p12');

  try {
    writeFileSync(p12Path, Buffer.from(p12Base64, 'base64'));

    const privateKeyPem = execFileSync('openssl', [
      'pkcs12', '-in', p12Path,
      '-nocerts', '-nodes',
      '-passin', `pass:${password}`,
    ], { encoding: 'utf-8' });

    const certificatePem = execFileSync('openssl', [
      'pkcs12', '-in', p12Path,
      '-nokeys', '-clcerts',
      '-passin', `pass:${password}`,
    ], { encoding: 'utf-8' });

    const keyMatch = privateKeyPem.match(
      /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/,
    );
    const certMatch = certificatePem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
    );

    if (!keyMatch) throw new Error('No private key found in PKCS#12 file');
    if (!certMatch) throw new Error('No certificate found in PKCS#12 file');

    return {
      privateKeyPem: keyMatch[0],
      certificatePem: certMatch[0],
    };
  } finally {
    try { unlinkSync(p12Path); } catch { /* ignore cleanup errors */ }
    try { unlinkSync(tempDir); } catch { /* ignore */ }
  }
}

/**
 * Creates a ParsedCertificate from raw PEM strings.
 * Use this when you already have separate PEM files.
 */
export function fromPem(privateKeyPem: string, certificatePem: string): ParsedCertificate {
  return { privateKeyPem, certificatePem };
}
