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

// Configuration
export { Mode, FormCodes } from './types/common.js';
export type { RequestOptions, Logger, ClientConfig, FormCode } from './types/common.js';

// Authentication
export type {
  AuthenticationChallengeResponse,
  AuthenticationInitResponse,
  AuthenticationStatusResponse,
  AuthenticationTokensResponse,
  AuthenticationRefreshResponse,
  AuthenticationMethodInfo,
  AuthenticateResult,
  StatusInfo,
  SubjectIdentifierType,
  TokenInfo,
} from './types/auth.js';
export type {
  AuthenticateParams,
  AuthenticationOperationParams,
  SubmitXadesSignatureParams,
} from './resources/auth.js';
export { buildAuthTokenRequest, AUTH_TOKEN_REQUEST_NS } from './utils/auth-xml.js';
export type { AuthTokenRequestParams } from './utils/auth-xml.js';

// Sessions
export type {
  OpenSessionParams,
  OpenSessionResult,
  SessionReferenceParams,
  SessionStatusResponse,
  SessionInvoicesParams,
  SessionInvoicesResponse,
  SessionInvoiceStatusParams,
  SessionInvoiceStatus,
  InvoiceStatusInfo,
  UpoPage,
} from './types/session.js';

// Invoices
export type {
  InvoiceSendParams,
  InvoiceSendResult,
  InvoiceStatusParams,
  InvoiceStatusResult,
  InvoiceDownloadParams,
  InvoiceQueryParams,
  InvoiceQueryFilters,
  InvoiceQueryDateRange,
  InvoiceQueryDateType,
  InvoiceQuerySubjectType,
  InvoiceQueryResult,
  InvoiceMetadata,
  InvoiceMetadataParty,
} from './types/invoice.js';

// UPO
export type {
  SessionUpoParams,
  InvoiceUpoParams,
  KsefNumberUpoParams,
  UpoDownloadParams,
} from './types/upo.js';

// Security
export type { PublicKeyCertificate, PublicKeyCertificateUsage } from './types/security.js';

// Cryptography and signing helpers (reusable for custom flows)
export { signXades } from './utils/xades.js';
export type { XadesSignParams } from './utils/xades.js';
export {
  generateSymmetricKey,
  encryptAes256Cbc,
  decryptAes256Cbc,
  encryptRsaOaepSha256,
  sha256Base64,
} from './utils/encryption.js';
export type { SymmetricKeyMaterial } from './utils/encryption.js';

// Validation
export { validateXmlAgainstXsd } from './utils/xsd.js';

// HTTP (for custom implementations)
export type {
  HttpClient,
  HttpMethod,
  HttpRequestConfig,
  HttpResponse,
} from './http/http-client.js';
