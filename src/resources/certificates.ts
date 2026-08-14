import { BaseResource } from './base-resource.js';
import type {
  CertificateEnrollParams,
  CertificateEnrollResult,
  CertificateRetrieveParams,
  CertificateRetrieveResult,
  CertificateRevokeParams,
  CertificateRevokeResult,
} from '../types/certificate.js';

export class CertificatesResource extends BaseResource {
  /**
   * Enrolls a new certificate in KSeF.
   */
  async enroll(params?: CertificateEnrollParams): Promise<CertificateEnrollResult> {
    return this.requestJson<CertificateEnrollResult>(
      'POST',
      '/online/Credentials/Certificate/Enroll',
      {
        body: {},
        requestOptions: params?.requestOptions,
      },
    );
  }

  /**
   * Retrieves certificate enrollment status.
   */
  async retrieve(params: CertificateRetrieveParams): Promise<CertificateRetrieveResult> {
    return this.requestJson<CertificateRetrieveResult>(
      'GET',
      `/online/Credentials/Certificate/Retrieve/${params.referenceNumber}`,
      { requestOptions: params.requestOptions },
    );
  }

  /**
   * Revokes a certificate.
   */
  async revoke(params: CertificateRevokeParams): Promise<CertificateRevokeResult> {
    return this.requestJson<CertificateRevokeResult>(
      'POST',
      `/online/Credentials/Certificate/Revoke/${params.referenceNumber}`,
      {
        body: {},
        requestOptions: params.requestOptions,
      },
    );
  }
}
