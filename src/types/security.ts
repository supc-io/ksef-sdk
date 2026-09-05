export type PublicKeyCertificateUsage = 'KsefTokenEncryption' | 'SymmetricKeyEncryption' | string;

export interface PublicKeyCertificate {
  /** X.509 certificate in DER form, base64-encoded. */
  certificate: string;
  certificateId: string;
  publicKeyId: string;
  validFrom: string;
  validTo: string;
  usage: PublicKeyCertificateUsage[];
}
