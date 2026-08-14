import type { RequestOptions } from './common.js';

export interface CertificateEnrollParams {
  requestOptions?: RequestOptions;
}

export interface CertificateEnrollResult {
  referenceNumber: string;
  timestamp: string;
}

export interface CertificateRetrieveParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface CertificateRetrieveResult {
  referenceNumber: string;
  certificateStatus: string;
  certificatePEM?: string;
  timestamp: string;
}

export interface CertificateRevokeParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface CertificateRevokeResult {
  referenceNumber: string;
  timestamp: string;
}
