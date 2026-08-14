import type { RequestOptions } from './common.js';

export interface InvoiceSendParams {
  xml: string;
  requestOptions?: RequestOptions;
}

export interface InvoiceSendResult {
  elementReferenceNumber: string;
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  timestamp: string;
}

export interface InvoiceStatusParams {
  invoiceElementReferenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface InvoiceStatusResult {
  processingCode: number;
  processingDescription: string;
  elementReferenceNumber: string;
  invoiceStatus?: {
    invoiceNumber: string;
    ksefReferenceNumber: string;
    acquisitionTimestamp: string;
  };
}

export interface InvoiceQueryParams {
  subjectType: 'subject1' | 'subject2' | 'subject3';
  type?: 'incremental' | 'range';
  invoicingDateFrom?: string;
  invoicingDateTo?: string;
  ksefReferenceNumberList?: string[];
  pageSize?: number;
  pageOffset?: number;
  requestOptions?: RequestOptions;
}

export interface InvoiceQueryResult {
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
  numberOfElements: number;
  pageSize: number;
  pageOffset: number;
  invoiceHeaderList: InvoiceHeader[];
}

export interface InvoiceHeader {
  invoiceReferenceNumber: string;
  ksefReferenceNumber: string;
  invoiceHash?: {
    hashSHA: { algorithm: string; encoding: string; value: string };
    fileSize: number;
  };
  invoicingDate: string;
  acquisitionTimestamp: string;
  net?: string;
  vat?: string;
  gross?: string;
  subjectBy: InvoiceSubject;
  subjectTo?: InvoiceSubject;
}

export interface InvoiceSubject {
  issuedByIdentifier?: { type: string; identifier: string };
  issuedToIdentifier?: { type: string; identifier: string };
  issuedByName?: { type: string; tradeName?: string; fullName?: string };
  issuedToName?: { type: string; tradeName?: string; fullName?: string };
}

export interface InvoiceDownloadParams {
  ksefReferenceNumber: string;
  requestOptions?: RequestOptions;
}
