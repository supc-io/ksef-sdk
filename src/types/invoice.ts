import type { RequestOptions } from './common.js';
import type { SessionInvoiceStatus } from './session.js';

export interface InvoiceSendParams {
  /** Invoice XML (FA schema). Encrypted with the session key before sending. */
  xml: string;
  /** Declare the invoice as issued in offline mode. */
  offlineMode?: boolean;
  /** SHA-256 (base64) of the corrected invoice; required for a technical correction. */
  hashOfCorrectedInvoice?: string;
  requestOptions?: RequestOptions;
}

export interface InvoiceSendResult {
  /** Reference number of the invoice within the session. */
  referenceNumber: string;
  sessionReferenceNumber: string;
  /** SHA-256 (base64) of the original invoice XML. */
  invoiceHash: string;
}

export interface InvoiceStatusParams {
  invoiceReferenceNumber: string;
  /** Defaults to the currently open session. */
  sessionReferenceNumber?: string;
  requestOptions?: RequestOptions;
}

export type InvoiceStatusResult = SessionInvoiceStatus;

export interface InvoiceDownloadParams {
  ksefNumber: string;
  requestOptions?: RequestOptions;
}

export type InvoiceQuerySubjectType = 'Subject1' | 'Subject2' | 'Subject3' | 'SubjectAuthorized';
export type InvoiceQueryDateType = 'Issue' | 'Invoicing' | 'PermanentStorage';

export interface InvoiceQueryDateRange {
  dateType: InvoiceQueryDateType;
  /** ISO 8601 date-time. */
  from: string;
  /** ISO 8601 date-time; defaults to now (UTC). Max range: 100 days. */
  to?: string;
  restrictToPermanentStorageHwmDate?: boolean;
}

export interface InvoiceQueryFilters {
  subjectType: InvoiceQuerySubjectType;
  dateRange: InvoiceQueryDateRange;
  ksefNumber?: string;
  invoiceNumber?: string;
  sellerNip?: string;
  buyerIdentifier?: { type: 'Nip' | 'VatUe' | 'Other'; value?: string };
  amount?: { type: 'Brutto' | 'Netto' | 'Vat'; from?: number; to?: number };
  currencyCodes?: string[];
  invoicingMode?: 'Online' | 'Offline';
  isSelfInvoicing?: boolean;
  formType?: 'FA' | 'PEF' | 'RR';
  invoiceTypes?: string[];
  hasAttachment?: boolean;
}

export interface InvoiceQueryParams {
  filters: InvoiceQueryFilters;
  /** 10..250, default 10. */
  pageSize?: number;
  pageOffset?: number;
  sortOrder?: 'Asc' | 'Desc';
  requestOptions?: RequestOptions;
}

export interface InvoiceMetadataParty {
  nip?: string;
  name?: string | null;
  identifier?: { type: string; value?: string | null };
}

export interface InvoiceMetadata {
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;
  invoicingDate: string;
  acquisitionDate: string;
  permanentStorageDate: string;
  seller: InvoiceMetadataParty;
  buyer: InvoiceMetadataParty;
  netAmount: number;
  grossAmount: number;
  vatAmount: number;
  currency: string;
  invoicingMode: 'Online' | 'Offline';
  invoiceType: string;
  formCode: { systemCode: string; schemaVersion: string; value: string };
  isSelfInvoicing: boolean;
  hasAttachment: boolean;
  invoiceHash: string;
  [key: string]: unknown;
}

export interface InvoiceQueryResult {
  hasMore: boolean;
  isTruncated: boolean;
  permanentStorageHwmDate?: string | null;
  invoices: InvoiceMetadata[];
}
