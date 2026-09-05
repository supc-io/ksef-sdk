import { createHash, createPrivateKey, createSign, randomUUID, X509Certificate } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { ExclusiveCanonicalization } from 'xml-crypto';
import { ConfigurationError } from '../errors/index.js';

export const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
export const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';

const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const SIGNED_PROPERTIES_TYPE = 'http://uri.etsi.org/01903#SignedProperties';

export interface XadesSignParams {
  xml: string;
  privateKeyPem: string;
  certificatePem: string;
  /** Signing time to embed in `xades:SigningTime`. Defaults to now. */
  signingTime?: Date;
}

/**
 * Signs an XML document with an enveloped XAdES-BES signature
 * (RSA-SHA256, Exclusive C14N), as required by KSeF for authentication requests.
 *
 * The produced `ds:Signature` is appended as the last child of the root element and contains:
 * - a reference to the whole document (`URI=""`, enveloped-signature + exc-c14n transforms),
 * - a reference of type `http://uri.etsi.org/01903#SignedProperties` covering the
 *   `xades:SignedProperties` element (SigningTime, SigningCertificate with the
 *   SHA-256 digest of the certificate and its IssuerSerial),
 * - `ds:KeyInfo` with the signing certificate.
 */
export function signXades(params: XadesSignParams): string {
  const { xml, privateKeyPem, certificatePem } = params;

  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new ConfigurationError(
      `Unsupported private key type "${privateKey.asymmetricKeyType}": XAdES signing currently supports RSA keys only`,
    );
  }

  const certificate = new X509Certificate(certificatePem);
  const document = parseXmlDocument(xml);
  const root = document.documentElement;
  if (!root) {
    throw new ConfigurationError('Cannot sign an XML document without a root element');
  }

  const id = randomUUID();
  const signatureId = `Signature-${id}`;
  const signedPropertiesId = `SignedProperties-${id}`;
  const signingTime = formatSigningTime(params.signingTime ?? new Date());

  // Reference 1: the document itself. The signature is appended after digesting,
  // which is exactly what the enveloped-signature transform yields on verification.
  const documentDigest = sha256Base64(canonicalize(root));

  // Reference 2: the XAdES SignedProperties.
  const signedProperties = buildSignedProperties(signedPropertiesId, signingTime, certificate);
  const signedPropertiesDigest = sha256Base64(
    canonicalize(
      selectElement(
        parseXmlDocument(wrapInSignatureContext(signedProperties)),
        XADES_NS,
        'SignedProperties',
      ),
    ),
  );

  const signedInfo = buildSignedInfo(
    id,
    documentDigest,
    signedPropertiesId,
    signedPropertiesDigest,
  );
  const signedInfoCanonical = canonicalize(
    selectElement(parseXmlDocument(wrapInSignatureContext(signedInfo)), DS_NS, 'SignedInfo'),
  );
  const signatureValue = createSign('RSA-SHA256')
    .update(signedInfoCanonical)
    .sign(privateKey, 'base64');

  const signature =
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${signatureId}">` +
    signedInfo +
    `<ds:SignatureValue Id="SignatureValue-${id}">${signatureValue}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certificate.raw.toString('base64')}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `<ds:Object><xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${signatureId}">` +
    signedProperties +
    `</xades:QualifyingProperties></ds:Object>` +
    `</ds:Signature>`;

  return insertBeforeClosingRootTag(xml, root.tagName, signature);
}

function buildSignedInfo(
  id: string,
  documentDigest: string,
  signedPropertiesId: string,
  signedPropertiesDigest: string,
): string {
  return (
    `<ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="${EXC_C14N}"/>` +
    `<ds:SignatureMethod Algorithm="${RSA_SHA256}"/>` +
    `<ds:Reference Id="Reference-${id}" URI="">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="${ENVELOPED_SIGNATURE}"/>` +
    `<ds:Transform Algorithm="${EXC_C14N}"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256}"/>` +
    `<ds:DigestValue>${documentDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference Type="${SIGNED_PROPERTIES_TYPE}" URI="#${signedPropertiesId}">` +
    `<ds:Transforms><ds:Transform Algorithm="${EXC_C14N}"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${SHA256}"/>` +
    `<ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`
  );
}

function buildSignedProperties(
  id: string,
  signingTime: string,
  certificate: X509Certificate,
): string {
  const certDigest = sha256Base64(certificate.raw);
  const issuerName = toRfc2253(certificate.issuer);
  const serialNumber = BigInt(`0x${certificate.serialNumber}`).toString(10);

  return (
    `<xades:SignedProperties Id="${id}">` +
    `<xades:SignedSignatureProperties>` +
    `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
    `<xades:SigningCertificate><xades:Cert>` +
    `<xades:CertDigest>` +
    `<ds:DigestMethod Algorithm="${SHA256}"/>` +
    `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
    `</xades:CertDigest>` +
    `<xades:IssuerSerial>` +
    `<ds:X509IssuerName>${escapeXml(issuerName)}</ds:X509IssuerName>` +
    `<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>` +
    `</xades:IssuerSerial>` +
    `</xades:Cert></xades:SigningCertificate>` +
    `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`
  );
}

/**
 * Wraps a signature fragment so that the `ds` and `xades` prefixes are in scope.
 * Exclusive C14N only emits namespaces that are visibly used, so the result of
 * canonicalizing the fragment here is identical to canonicalizing it inside
 * the final signed document.
 */
function wrapInSignatureContext(fragment: string): string {
  return `<ds:Signature xmlns:ds="${DS_NS}" xmlns:xades="${XADES_NS}">${fragment}</ds:Signature>`;
}

function canonicalize(element: Element): string {
  return new ExclusiveCanonicalization().process(element, {});
}

function sha256Base64(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('base64');
}

function parseXmlDocument(xml: string): Document {
  const parser = new DOMParser({
    errorHandler: {
      // The documents signed here are generated by the SDK itself, so any
      // parser complaint (xmldom only warns about some malformed input) is a bug.
      warning: (message: string) => {
        throw new ConfigurationError(`Cannot sign malformed XML: ${message}`);
      },
      error: (message: string) => {
        throw new ConfigurationError(`Cannot sign malformed XML: ${message}`);
      },
      fatalError: (message: string) => {
        throw new ConfigurationError(`Cannot sign malformed XML: ${message}`);
      },
    },
  });
  return parser.parseFromString(xml, 'text/xml') as unknown as Document;
}

function selectElement(document: Document, namespace: string, localName: string): Element {
  const element = document.getElementsByTagNameNS(namespace, localName)[0];
  if (!element) {
    throw new ConfigurationError(
      `Element ${localName} not found while building the XAdES signature`,
    );
  }
  return element;
}

function insertBeforeClosingRootTag(xml: string, rootTagName: string, signature: string): string {
  const closingTagStart = xml.lastIndexOf(`</${rootTagName}`);
  if (closingTagStart === -1) {
    throw new ConfigurationError(
      `Cannot locate the closing tag of the root element <${rootTagName}>; self-closing root elements cannot carry an enveloped signature`,
    );
  }
  return xml.slice(0, closingTagStart) + signature + xml.slice(closingTagStart);
}

/** xsd:dateTime in UTC without fractional seconds, e.g. 2026-09-03T12:00:00Z. */
function formatSigningTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Converts Node's multi-line issuer representation ("C=PL\nO=Org\nCN=CA") into
 * the RFC 2253 string form expected in `ds:X509IssuerName` ("CN=CA,O=Org,C=PL").
 * Node already applies RFC 2253 escaping to each value (e.g. "O=Test\, Org"),
 * so the lines only need to be reversed and joined.
 */
export function toRfc2253(distinguishedName: string): string {
  return distinguishedName
    .split('\n')
    .filter((line) => line.length > 0)
    .reverse()
    .join(',');
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
