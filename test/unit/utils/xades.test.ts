import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, X509Certificate } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { signXades, toRfc2253, DS_NS, XADES_NS } from '../../../src/utils/xades.js';
import { buildXml } from '../../../src/utils/xml.js';
import { ConfigurationError } from '../../../src/errors/index.js';
import { createTestKeyMaterial, hasOpenssl } from '../../helpers/openssl.js';
import type { TestKeyMaterial } from '../../helpers/openssl.js';

const SAMPLE_XML = buildXml({
  InitSessionSignedRequest: {
    '@_xmlns': 'http://ksef.mf.gov.pl/schema/gtw/svc/online/types/2021/10/01/0001',
    Context: {
      Challenge: '20260903-CR-ABCDEF1234-0123456789-AB',
      Identifier: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xsi:type': 'SubjectIdentifierByCompanyType',
        Identifier: '1234563218',
      },
      Token: 'token-value',
    },
    Timestamp: '2026-09-03T10:00:00.000Z',
  },
});

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
}

function verifyWithXmlCrypto(signedXml: string, certPem: string): boolean {
  const doc = parse(signedXml);
  const signatureNode = doc.getElementsByTagNameNS(DS_NS, 'Signature')[0];
  const verifier = new SignedXml({ publicCert: certPem });
  verifier.loadSignature(signatureNode as unknown as Node);
  try {
    return verifier.checkSignature(signedXml);
  } catch {
    return false;
  }
}

describe.skipIf(!hasOpenssl())('signXades', () => {
  let material: TestKeyMaterial;
  let signedXml: string;
  let doc: Document;

  beforeAll(() => {
    material = createTestKeyMaterial({ subject: '/C=PL/O=Test, Org/CN=KSeF SDK Test CA' });
    signedXml = signXades({
      xml: SAMPLE_XML,
      privateKeyPem: material.keyPem,
      certificatePem: material.certPem,
      signingTime: new Date('2026-09-03T10:00:01.500Z'),
    });
    doc = parse(signedXml);
  });

  afterAll(() => {
    material.cleanup();
  });

  it('produces a signature that verifies (both references) with xml-crypto', () => {
    expect(verifyWithXmlCrypto(signedXml, material.certPem)).toBe(true);
  });

  it('keeps the original document bytes intact and appends the signature inside the root', () => {
    const closing = '</InitSessionSignedRequest>';
    const signatureStart = signedXml.indexOf('<ds:Signature');
    expect(signatureStart).toBeGreaterThan(0);
    expect(signedXml.slice(0, signatureStart)).toBe(
      SAMPLE_XML.slice(0, SAMPLE_XML.lastIndexOf(closing)),
    );
    expect(signedXml.endsWith(SAMPLE_XML.slice(SAMPLE_XML.lastIndexOf(closing)))).toBe(true);
    expect(doc.documentElement?.hasAttribute('Id')).toBe(false);
  });

  it('references the SignedProperties with the XAdES Type and matching Id', () => {
    const references = Array.from(doc.getElementsByTagNameNS(DS_NS, 'Reference'));
    expect(references).toHaveLength(2);

    const [documentRef, propsRef] = references;
    expect(documentRef.getAttribute('URI')).toBe('');
    const transforms = Array.from(documentRef.getElementsByTagNameNS(DS_NS, 'Transform')).map((t) =>
      t.getAttribute('Algorithm'),
    );
    expect(transforms).toEqual([
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ]);

    expect(propsRef.getAttribute('Type')).toBe('http://uri.etsi.org/01903#SignedProperties');
    const signedProperties = doc.getElementsByTagNameNS(XADES_NS, 'SignedProperties')[0];
    expect(propsRef.getAttribute('URI')).toBe(`#${signedProperties.getAttribute('Id')}`);
  });

  it('links QualifyingProperties to the Signature Id', () => {
    const signature = doc.getElementsByTagNameNS(DS_NS, 'Signature')[0];
    const qualifying = doc.getElementsByTagNameNS(XADES_NS, 'QualifyingProperties')[0];
    expect(signature.getAttribute('Id')).toMatch(/^Signature-/);
    expect(qualifying.getAttribute('Target')).toBe(`#${signature.getAttribute('Id')}`);
  });

  it('embeds the certificate digest, issuer serial, signing time and the certificate itself', () => {
    const cert = new X509Certificate(material.certPem);
    const expectedDigest = createHash('sha256').update(cert.raw).digest('base64');

    const certDigest = doc.getElementsByTagNameNS(XADES_NS, 'CertDigest')[0];
    expect(certDigest.getElementsByTagNameNS(DS_NS, 'DigestValue')[0].textContent).toBe(
      expectedDigest,
    );

    expect(doc.getElementsByTagNameNS(DS_NS, 'X509IssuerName')[0].textContent).toBe(
      'CN=KSeF SDK Test CA,O=Test\\, Org,C=PL',
    );
    expect(doc.getElementsByTagNameNS(DS_NS, 'X509SerialNumber')[0].textContent).toBe(
      BigInt(`0x${cert.serialNumber}`).toString(10),
    );
    expect(doc.getElementsByTagNameNS(XADES_NS, 'SigningTime')[0].textContent).toBe(
      '2026-09-03T10:00:01Z',
    );
    expect(doc.getElementsByTagNameNS(DS_NS, 'X509Certificate')[0].textContent).toBe(
      cert.raw.toString('base64'),
    );
  });

  it('detects tampering with the signed properties', () => {
    const tampered = signedXml.replace('2026-09-03T10:00:01Z', '2026-09-03T10:00:02Z');
    expect(tampered).not.toBe(signedXml);
    expect(verifyWithXmlCrypto(tampered, material.certPem)).toBe(false);
  });

  it('detects tampering with the document', () => {
    const tampered = signedXml.replace('1234563218', '1234567890');
    expect(tampered).not.toBe(signedXml);
    expect(verifyWithXmlCrypto(tampered, material.certPem)).toBe(false);
  });

  it('rejects malformed XML and self-closing roots', () => {
    expect(() =>
      signXades({
        xml: '<a><b></a>',
        privateKeyPem: material.keyPem,
        certificatePem: material.certPem,
      }),
    ).toThrow(ConfigurationError);
    expect(() =>
      signXades({ xml: '<a/>', privateKeyPem: material.keyPem, certificatePem: material.certPem }),
    ).toThrow(ConfigurationError);
  });
});

describe('toRfc2253', () => {
  it("reverses the RDN order of Node's multi-line form and keeps its escaping", () => {
    expect(toRfc2253('C=PL\nO=Test\\, Org\nCN=CA')).toBe('CN=CA,O=Test\\, Org,C=PL');
    expect(toRfc2253('CN=only')).toBe('CN=only');
  });
});
