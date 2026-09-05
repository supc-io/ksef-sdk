import type { RequestOptions } from './common.js';

export interface PermissionGrantParams {
  contextNip: string;
  credentialsIdentifier: {
    type: 'onip' | 'pesel' | 'fingerprint';
    identifier: string;
  };
  credentialsRoleList: CredentialRole[];
  requestOptions?: RequestOptions;
}

export interface CredentialRole {
  roleType:
    | 'invoice_read'
    | 'invoice_write'
    | 'payment_confirmation_write'
    | 'credentials_read'
    | 'credentials_manage'
    | 'enforcement_operations'
    | 'self_invoicing'
    | 'tax_representative'
    | 'court_bailiff'
    | 'subject_read_all'
    | 'subject_read_delivered';
  roleDescription?: string;
  startTimestamp?: string;
  endTimestamp?: string;
}

export interface PermissionGrantResult {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  elementReferenceNumber: string;
}

export interface PermissionRevokeParams {
  contextNip: string;
  credentialsIdentifier: {
    type: 'onip' | 'pesel' | 'fingerprint';
    identifier: string;
  };
  credentialsRoleList: CredentialRole[];
  requestOptions?: RequestOptions;
}

export interface PermissionRevokeResult {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
  elementReferenceNumber: string;
}

export interface PermissionQueryParams {
  contextNip: string;
  pageSize?: number;
  pageOffset?: number;
  requestOptions?: RequestOptions;
}

export interface PermissionQueryResult {
  referenceNumber: string;
  numberOfElements: number;
  pageSize: number;
  pageOffset: number;
  credentialsList: PermissionCredential[];
}

export interface PermissionCredential {
  credentialsIdentifier: {
    type: string;
    identifier: string;
  };
  credentialsRoleList: CredentialRole[];
}
