import { SignedXml } from 'xml-crypto';
import { randomUUID } from 'node:crypto';

export interface XadesSignParams {
  xml: string;
  privateKeyPem: string;
  certificatePem: string;
}

/**
 * Signs XML with XAdES-BES using the provided certificate and private key.
 * Used for KSeF InitSigned — signing the authorisation challenge.
 */
export function signXades(params: XadesSignParams): string {
  const { xml, privateKeyPem, certificatePem } = params;

  const sigId = `id-${randomUUID()}`;
  const signedPropsId = `xades-${sigId}`;
  const signingTime = new Date().toISOString();

  const xadesSignedProperties =
    `<xades:SignedProperties Id="${signedPropsId}">` +
    `<xades:SignedSignatureProperties>` +
    `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
    `<xades:SigningCertificate>` +
    `<xades:Cert>` +
    `<xades:CertDigest>` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<ds:DigestValue></ds:DigestValue>` +
    `</xades:CertDigest>` +
    `</xades:Cert>` +
    `</xades:SigningCertificate>` +
    `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`;

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });

  sig.addReference({
    xpath: '/*',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });

  sig.computeSignature(xml, {
    prefix: 'ds',
    location: { reference: '/*', action: 'append' },
  });

  let signedXml = sig.getSignedXml();

  // Inject XAdES QualifyingProperties into the Signature element
  const qualifyingProperties =
    `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">` +
    xadesSignedProperties +
    `</xades:QualifyingProperties>`;

  const objectElement = `<ds:Object>${qualifyingProperties}</ds:Object>`;
  signedXml = signedXml.replace('</ds:Signature>', `${objectElement}</ds:Signature>`);

  return signedXml;
}
