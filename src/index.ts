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
  SessionError,
  XsdValidationError,
} from './errors/index.js';

export type { XsdValidationDetail } from './errors/index.js';

// Types
export { Mode } from './types/common.js';
export type { RequestOptions, Logger, ClientConfig } from './types/common.js';

export type {
  AuthorisationChallengeRequest,
  AuthorisationChallengeResponse,
  InitSignedRequest,
  InitSignedResponse,
} from './types/auth.js';

export type {
  SessionInitResult,
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
  BatchInitParams,
  BatchInitResult,
  PackagePartSignature,
  BatchHeaderEntry,
  BatchSendParams,
  BatchSendResult,
  BatchFinishParams,
  BatchFinishResult,
  BatchStatusParams,
  BatchStatusResult,
} from './types/batch.js';

export type {
  CertificateEnrollParams,
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
  PermissionCredential,
  CredentialRole,
} from './types/permission.js';

export type {
  ContextLimitParams,
  ContextLimitResult,
  SubjectLimitParams,
  SubjectLimitResult,
  RateLimitParams,
  RateLimitResult,
  LimitEntry,
} from './types/limit.js';

export type {
  ExportInitParams,
  ExportInitResult,
  ExportStatusParams,
  ExportStatusResult,
  ExportPart,
  ExportDownloadParams,
  UpoParams,
  UpoResult,
} from './types/export.js';

// Validation
export { validateXmlAgainstXsd } from './utils/xsd.js';

// HTTP (for custom implementations)
export type {
  HttpClient,
  HttpMethod,
  HttpRequestConfig,
  HttpResponse,
} from './http/http-client.js';
