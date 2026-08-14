// Client
export { KsefClient } from './client.js';
export { KsefClientBuilder } from './client-builder.js';

// Errors
export {
  KsefError,
  KsefApiError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  ConnectionError,
  ConfigurationError,
} from './errors/index.js';

// Types
export { Mode } from './types/common.js';
export type {
  RequestOptions,
  Logger,
  ClientConfig,
} from './types/common.js';

export type {
  AuthorisationChallengeResponse,
  InitSignedResponse,
} from './types/auth.js';

export type {
  SessionInitResult,
  SessionStatus,
  SessionStatusResponse,
  SessionTerminateResponse,
} from './types/session.js';

export type {
  InvoiceSendParams,
  InvoiceSendResult,
  InvoiceStatusParams,
  InvoiceStatusResult,
  InvoiceQueryParams,
  InvoiceQueryResult,
  InvoiceHeader,
  InvoiceSubject,
  InvoiceDownloadParams,
} from './types/invoice.js';

export type {
  BatchInitResult,
  BatchSendParams,
  BatchSendResult,
  BatchFinishParams,
  BatchFinishResult,
  BatchStatusParams,
  BatchStatusResult,
} from './types/batch.js';

export type {
  CertificateEnrollResult,
  CertificateRetrieveParams,
  CertificateRetrieveResult,
  CertificateRevokeParams,
  CertificateRevokeResult,
} from './types/certificate.js';

export type {
  PermissionGrantParams,
  PermissionGrantResult,
  PermissionRevokeParams,
  PermissionRevokeResult,
  PermissionQueryParams,
  PermissionQueryResult,
  CredentialRole,
} from './types/permission.js';

export type {
  ContextLimitResult,
  SubjectLimitResult,
  RateLimitResult,
  LimitEntry,
} from './types/limit.js';

export type {
  ExportInitParams,
  ExportInitResult,
  ExportStatusParams,
  ExportStatusResult,
  ExportDownloadParams,
  UpoParams,
  UpoResult,
} from './types/export.js';

// HTTP (for custom implementations)
export type { HttpClient, HttpRequestConfig, HttpResponse } from './http/http-client.js';
