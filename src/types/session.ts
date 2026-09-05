import type { FormCode, RequestOptions } from './common.js';
import type { StatusInfo } from './auth.js';

export interface OpenSessionParams {
  /** Invoice schema for the session. Defaults to the client's `formCode` (FA (3)). */
  formCode?: FormCode;
  requestOptions?: RequestOptions;
}

export interface OpenSessionResult {
  referenceNumber: string;
  /** ISO 8601 date-time after which KSeF closes the session automatically. */
  validUntil: string;
  formCode: FormCode;
}

/** State of the currently open interactive session, including its symmetric key. */
export interface OnlineSession extends OpenSessionResult {
  symmetricKey: Buffer;
  initializationVector: Buffer;
}

export interface UpoPage {
  referenceNumber: string;
  downloadUrl: string;
  downloadUrlExpirationDate: string;
}

/**
 * Interactive session status codes: 100 open, 170 closed, 200 processed
 * successfully, 415 symmetric key decryption error, 440 cancelled
 * (no invoices sent), 445 no valid invoices.
 */
export interface SessionStatusResponse {
  status: StatusInfo;
  dateCreated: string;
  dateUpdated: string;
  validUntil?: string | null;
  upo?: { pages: UpoPage[] } | null;
  invoiceCount?: number | null;
  successfulInvoiceCount?: number | null;
  failedInvoiceCount?: number | null;
}

export interface InvoiceStatusInfo extends StatusInfo {
  extensions?: Record<string, string | null> | null;
}

/**
 * Invoice status codes: 100 accepted for processing, 150 processing,
 * 200 KSeF number assigned, 4xx rejected (see `status.description`).
 */
export interface SessionInvoiceStatus {
  ordinalNumber: number;
  invoiceNumber?: string | null;
  ksefNumber?: string | null;
  referenceNumber: string;
  invoiceHash: string;
  invoiceFileName?: string | null;
  acquisitionDate?: string | null;
  invoicingDate: string;
  permanentStorageDate?: string | null;
  upoDownloadUrl?: string | null;
  upoDownloadUrlExpirationDate?: string | null;
  invoicingMode?: 'Online' | 'Offline' | null;
  status: InvoiceStatusInfo;
}

export interface SessionInvoicesResponse {
  continuationToken?: string | null;
  invoices: SessionInvoiceStatus[];
}

export interface SessionReferenceParams {
  /** Session reference number. Defaults to the currently open session. */
  referenceNumber?: string;
  requestOptions?: RequestOptions;
}

export interface SessionInvoicesParams extends SessionReferenceParams {
  /** 10..1000, default 10. */
  pageSize?: number;
  continuationToken?: string;
}

export interface SessionInvoiceStatusParams extends SessionReferenceParams {
  invoiceReferenceNumber: string;
}
