import { BaseResource } from './base-resource.js';
import type { ResourceContext } from './base-resource.js';
import type { SecurityResource } from './security.js';
import type {
  OnlineSession,
  OpenSessionParams,
  OpenSessionResult,
  SessionInvoiceStatus,
  SessionInvoiceStatusParams,
  SessionInvoicesParams,
  SessionInvoicesResponse,
  SessionReferenceParams,
  SessionStatusResponse,
} from '../types/session.js';
import { encryptRsaOaepSha256, generateSymmetricKey } from '../utils/encryption.js';

/**
 * Interactive (online) sessions: `POST /sessions/online`, `GET /sessions/{ref}`,
 * `GET /sessions/{ref}/invoices[/{invoiceRef}]`, `POST /sessions/online/{ref}/close`.
 */
export class SessionsResource extends BaseResource {
  constructor(
    context: ResourceContext,
    private readonly security: SecurityResource,
  ) {
    super(context);
  }

  /** The currently open session (without key material), or `null`. */
  get current(): OpenSessionResult | null {
    const session = this.context.session.session;
    if (!session) return null;
    const { referenceNumber, validUntil, formCode } = session;
    return { referenceNumber, validUntil, formCode };
  }

  /**
   * Opens an interactive session. Generates a fresh AES-256 key and IV,
   * encrypts the key with the Ministry of Finance public key (RSA-OAEP SHA-256)
   * and remembers the session so that `invoices.send()` can encrypt payloads.
   */
  async open(params?: OpenSessionParams): Promise<OpenSessionResult> {
    const formCode = params?.formCode ?? this.config.formCode;
    const certificate = await this.security.symmetricKeyEncryptionCertificate({
      requestOptions: params?.requestOptions,
    });
    const { key, iv } = generateSymmetricKey();

    const response = await this.requestJson<{ referenceNumber: string; validUntil: string }>(
      'POST',
      '/sessions/online',
      {
        body: {
          formCode,
          encryption: {
            encryptedSymmetricKey: encryptRsaOaepSha256(key, certificate.certificate).toString(
              'base64',
            ),
            initializationVector: iv.toString('base64'),
            publicKeyId: certificate.publicKeyId,
          },
        },
        requestOptions: params?.requestOptions,
      },
    );

    const session: OnlineSession = {
      referenceNumber: response.referenceNumber,
      validUntil: response.validUntil,
      formCode,
      symmetricKey: key,
      initializationVector: iv,
    };
    this.context.session.setSession(session);
    this.logger?.info(
      `Opened session ${session.referenceNumber} (valid until ${session.validUntil})`,
    );

    return { referenceNumber: session.referenceNumber, validUntil: session.validUntil, formCode };
  }

  /** `GET /sessions/{referenceNumber}` */
  async status(params?: SessionReferenceParams): Promise<SessionStatusResponse> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params?.referenceNumber);
    return this.requestJson<SessionStatusResponse>(
      'GET',
      `/sessions/${encodeURIComponent(referenceNumber)}`,
      {
        requestOptions: params?.requestOptions,
      },
    );
  }

  /** `GET /sessions/{referenceNumber}/invoices` (paged with `x-continuation-token`). */
  async invoices(params?: SessionInvoicesParams): Promise<SessionInvoicesResponse> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params?.referenceNumber);
    return this.requestJson<SessionInvoicesResponse>(
      'GET',
      `/sessions/${encodeURIComponent(referenceNumber)}/invoices`,
      {
        query: { pageSize: params?.pageSize },
        headers: params?.continuationToken
          ? { 'x-continuation-token': params.continuationToken }
          : undefined,
        requestOptions: params?.requestOptions,
      },
    );
  }

  /** `GET /sessions/{referenceNumber}/invoices/{invoiceReferenceNumber}` */
  async invoiceStatus(params: SessionInvoiceStatusParams): Promise<SessionInvoiceStatus> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params.referenceNumber);
    return this.requestJson<SessionInvoiceStatus>(
      'GET',
      `/sessions/${encodeURIComponent(referenceNumber)}/invoices/${encodeURIComponent(params.invoiceReferenceNumber)}`,
      { requestOptions: params.requestOptions },
    );
  }

  /**
   * `POST /sessions/online/{referenceNumber}/close`. KSeF then generates the
   * session UPO asynchronously; poll `status()` until `upo.pages` appears.
   */
  async close(params?: SessionReferenceParams): Promise<void> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params?.referenceNumber);
    await this.requestRaw('POST', `/sessions/online/${encodeURIComponent(referenceNumber)}/close`, {
      requestOptions: params?.requestOptions,
    });
    if (this.context.session.referenceNumber === referenceNumber) {
      this.context.session.clear();
    }
    this.logger?.info(`Closed session ${referenceNumber}`);
  }
}
