import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface TestKeyMaterial {
  dir: string;
  keyPem: string;
  certPem: string;
  p12Base64: string;
  password: string;
  cleanup(): void;
}

export function hasOpenssl(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function opensslMajorVersion(): number {
  const out = execFileSync('openssl', ['version'], { encoding: 'utf-8' });
  const match = out.match(/(?:OpenSSL|LibreSSL)\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Generates a throw-away RSA key, self-signed certificate and PKCS#12 bundle
 * with the system openssl CLI.
 */
export function createTestKeyMaterial(options?: {
  subject?: string;
  password?: string;
  legacy?: boolean;
}): TestKeyMaterial {
  const dir = mkdtempSync(join(tmpdir(), 'ksef-sdk-test-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  const p12Path = join(dir, 'cert.p12');
  const password = options?.password ?? 'test-password';
  const subject = options?.subject ?? '/C=PL/O=KSeF SDK Test/CN=ksef-sdk-test';

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-subj',
      subject,
      '-days',
      '1',
    ],
    { stdio: 'ignore' },
  );

  const exportArgs = [
    'pkcs12',
    '-export',
    '-inkey',
    keyPath,
    '-in',
    certPath,
    '-out',
    p12Path,
    '-passout',
    'env:TEST_P12_PASSWORD',
  ];
  if (options?.legacy) exportArgs.push('-legacy');

  execFileSync('openssl', exportArgs, {
    stdio: 'ignore',
    env: { ...process.env, TEST_P12_PASSWORD: password },
  });

  return {
    dir,
    keyPem: readFileSync(keyPath, 'utf-8'),
    certPem: readFileSync(certPath, 'utf-8'),
    p12Base64: readFileSync(p12Path).toString('base64'),
    password,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
