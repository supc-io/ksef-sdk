import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigurationError } from '../errors/index.js';

export interface ParsedCertificate {
  privateKeyPem: string;
  certificatePem: string;
}

/**
 * Environment variable through which the PKCS#12 password is handed to
 * openssl. Passing it as `-passin pass:...` would expose it on the command
 * line (visible in `ps` and embedded in openssl error messages).
 */
const PASSWORD_ENV = 'KSEF_SDK_PKCS12_PASSWORD';

const PRIVATE_KEY_RE =
  /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/;
const CERTIFICATE_RE = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

/**
 * Parses a PKCS#12 (.p12/.pfx) file and extracts the private key and certificate.
 * Uses the openssl CLI which is available on all platforms where KSeF integration is used.
 *
 * @param p12Base64 - Base64-encoded PKCS#12 file content
 * @param password - Password for the PKCS#12 file (may be empty)
 * @throws ConfigurationError when openssl is missing, the password is wrong or the file is invalid
 */
export function parsePkcs12(p12Base64: string, password: string): ParsedCertificate {
  const tempDir = mkdtempSync(join(tmpdir(), 'ksef-'));
  const p12Path = join(tempDir, 'cert.p12');

  try {
    writeFileSync(p12Path, Buffer.from(p12Base64, 'base64'), { mode: 0o600 });

    const privateKeyPem = runOpenssl(
      ['pkcs12', '-in', p12Path, '-nocerts', '-nodes', '-passin', `env:${PASSWORD_ENV}`],
      password,
    );

    const certificatePem = runOpenssl(
      ['pkcs12', '-in', p12Path, '-nokeys', '-clcerts', '-passin', `env:${PASSWORD_ENV}`],
      password,
    );

    const keyMatch = privateKeyPem.match(PRIVATE_KEY_RE);
    const certMatch = certificatePem.match(CERTIFICATE_RE);

    if (!keyMatch) throw new ConfigurationError('No private key found in PKCS#12 file');
    if (!certMatch) throw new ConfigurationError('No certificate found in PKCS#12 file');

    return {
      privateKeyPem: keyMatch[0],
      certificatePem: certMatch[0],
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runOpenssl(args: string[], password: string, legacy = false): string {
  const finalArgs = legacy ? [...args, '-legacy'] : args;

  try {
    return execFileSync('openssl', finalArgs, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, [PASSWORD_ENV]: password },
    });
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { stderr?: string | Buffer };

    if (error.code === 'ENOENT') {
      throw new ConfigurationError(
        'openssl CLI not found in PATH. It is required to parse PKCS#12 certificates.',
      );
    }

    const stderr = String(error.stderr ?? '').trim();

    // OpenSSL 3 refuses the RC2/3DES algorithms used by many older PKCS#12
    // exports unless the legacy provider is loaded explicitly.
    if (!legacy && /unsupported|legacy/i.test(stderr)) {
      return runOpenssl(args, password, true);
    }

    const reason = stderr ? `: ${stderr}` : '';
    throw new ConfigurationError(
      `Failed to parse PKCS#12 certificate with openssl (check the password and file format)${reason}`,
    );
  }
}
