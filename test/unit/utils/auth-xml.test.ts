import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { buildAuthTokenRequest, AUTH_TOKEN_REQUEST_NS } from '../../../src/utils/auth-xml.js';

const CHALLENGE = '20250604-CR-461EA5B000-537A6BA15D-D7';
const XSD_PATH = resolve(__dirname, '../../fixtures/schemat_auth_v2-0.xsd');

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * The Ministry's XSD uses Perl-style anchors (`^`, `$`, `\b`) inside
 * `xsd:pattern`, which is not valid XML Schema regex syntax; libxml2 refuses to
 * compile it. XSD patterns are implicitly anchored, so stripping the anchors
 * yields an equivalent schema that xmllint accepts.
 */
function sanitizedSchema(): string {
  return readFileSync(XSD_PATH, 'utf-8')
    .replace(/value="\^/g, 'value="')
    .replace(/\$"/g, '"')
    .replace(/\\b/g, '');
}

/** Returns true when xmllint accepts the document (it reports "validates" on stderr). */
function validateWithXmllint(xml: string): { ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ksef-auth-xml-'));
  const file = join(dir, 'auth.xml');
  const schema = join(dir, 'auth.xsd');
  try {
    writeFileSync(file, xml);
    writeFileSync(schema, sanitizedSchema());
    execFileSync('xmllint', ['--noout', '--schema', schema, file], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: '' };
  } catch (err) {
    return { ok: false, output: String((err as { stderr?: string }).stderr ?? err) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('buildAuthTokenRequest', () => {
  const xml = buildAuthTokenRequest({ challenge: CHALLENGE, nip: '5265877635' });

  it('produces the documented AuthTokenRequest structure', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
    const root = doc.documentElement!;
    expect(root.localName).toBe('AuthTokenRequest');
    expect(root.namespaceURI).toBe(AUTH_TOKEN_REQUEST_NS);

    const children = Array.from(root.childNodes)
      .filter((n) => n.nodeType === 1)
      .map((n) => (n as Element).localName);
    expect(children).toEqual(['Challenge', 'ContextIdentifier', 'SubjectIdentifierType']);

    expect(doc.getElementsByTagNameNS(AUTH_TOKEN_REQUEST_NS, 'Challenge')[0].textContent).toBe(
      CHALLENGE,
    );
    expect(doc.getElementsByTagNameNS(AUTH_TOKEN_REQUEST_NS, 'Nip')[0].textContent).toBe(
      '5265877635',
    );
    expect(
      doc.getElementsByTagNameNS(AUTH_TOKEN_REQUEST_NS, 'SubjectIdentifierType')[0].textContent,
    ).toBe('certificateSubject');
  });

  it('supports certificateFingerprint identification', () => {
    const fingerprintXml = buildAuthTokenRequest({
      challenge: CHALLENGE,
      nip: '5265877635',
      subjectIdentifierType: 'certificateFingerprint',
    });
    expect(fingerprintXml).toContain(
      '<SubjectIdentifierType>certificateFingerprint</SubjectIdentifierType>',
    );
  });

  it.skipIf(!hasXmllint())('validates against the official auth v2.0 XSD', () => {
    const result = validateWithXmllint(xml);
    expect(result.output).toBe('');
    expect(result.ok).toBe(true);

    const invalid = validateWithXmllint(xml.replace('<Nip>5265877635</Nip>', '<Nip>12</Nip>'));
    expect(invalid.ok).toBe(false);
    expect(invalid.output).toMatch(/Nip/);
  });
});
