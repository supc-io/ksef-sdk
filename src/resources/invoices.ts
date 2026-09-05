import { BaseResource } from './base-resource.js';
import type { ResourceContext } from './base-resource.js';
import type { SessionsResource } from './sessions.js';
import { validateXmlAgainstXsd } from '../utils/xsd.js';
import { encryptAes256Cbc, sha256Base64 } from '../utils/encryption.js';
import type {
  InvoiceDownloadParams,
  InvoiceQueryParams,
  InvoiceQueryResult,
  InvoiceSendParams,
  InvoiceSendResult,
  InvoiceStatusParams,
  InvoiceStatusResult,
} from '../types/invoice.js';

export class InvoicesResource extends BaseResource {
  constructor(
    context: ResourceContext,
    private readonly sessions: SessionsResource,
  ) {
    super(context);
  }

  /**
   * Sends an invoice within the open interactive session
   * (`POST /sessions/online/{referenceNumber}/invoices`, HTTP 202).
   *
   * The XML is optionally validated against the configured XSD, then encrypted
   * with the session's AES-256-CBC key; both the plain and encrypted SHA-256
   * digests and sizes are sent alongside the payload.
   */
  async send(params: InvoiceSendParams): Promise<InvoiceSendResult> {
    if (this.config.validateXml && this.config.xsdSchemaPath) {
      this.logger?.debug('Validating invoice XML against XSD schema');
      validateXmlAgainstXsd(params.xml, this.config.xsdSchemaPath);
    }

    const session = this.context.session.requireSession();
    const plain = Buffer.from(params.xml, 'utf-8');
    const encrypted = encryptAes256Cbc(plain, session.symmetricKey, session.initializationVector);
    const invoiceHash = sha256Base64(plain);

    const body: Record<string, unknown> = {
      invoiceHash,
      invoiceSize: plain.length,
      encryptedInvoiceHash: sha256Base64(encrypted),
      encryptedInvoiceSize: encrypted.length,
      encryptedInvoiceContent: encrypted.toString('base64'),
      offlineMode: params.offlineMode ?? false,
    };
    if (params.hashOfCorrectedInvoice) {
      body.hashOfCorrectedInvoice = params.hashOfCorrectedInvoice;
    }

    const response = await this.requestJson<{ referenceNumber: string }>(
      'POST',
      `/sessions/online/${encodeURIComponent(session.referenceNumber)}/invoices`,
      { body, requestOptions: params.requestOptions },
    );

    this.logger?.info(`Invoice accepted for processing, ref: ${response.referenceNumber}`);
    return {
      referenceNumber: response.referenceNumber,
      sessionReferenceNumber: session.referenceNumber,
      invoiceHash,
    };
  }

  /** Processing status of an invoice sent in a session. */
  async status(params: InvoiceStatusParams): Promise<InvoiceStatusResult> {
    return this.sessions.invoiceStatus({
      referenceNumber: params.sessionReferenceNumber,
      invoiceReferenceNumber: params.invoiceReferenceNumber,
      requestOptions: params.requestOptions,
    });
  }

  /** `GET /invoices/ksef/{ksefNumber}`: the invoice XML. Requires `InvoiceRead`. */
  async download(params: InvoiceDownloadParams): Promise<string> {
    return this.requestText('GET', `/invoices/ksef/${encodeURIComponent(params.ksefNumber)}`, {
      requestOptions: params.requestOptions,
    });
  }

  /** `POST /invoices/query/metadata`: invoice metadata matching the filters. */
  async query(params: InvoiceQueryParams): Promise<InvoiceQueryResult> {
    return this.requestJson<InvoiceQueryResult>('POST', '/invoices/query/metadata', {
      body: params.filters,
      query: {
        sortOrder: params.sortOrder,
        pageOffset: params.pageOffset,
        pageSize: params.pageSize,
      },
      requestOptions: params.requestOptions,
    });
  }
}
