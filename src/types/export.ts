import type { RequestOptions } from './common.js';

export interface ExportInitParams {
  dateFrom: string;
  dateTo: string;
  subjectType?: 'subject1' | 'subject2';
  requestOptions?: RequestOptions;
}

export interface ExportInitResult {
  referenceNumber: string;
  timestamp: string;
}

export interface ExportStatusParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface ExportStatusResult {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  partList?: ExportPart[];
}

export interface ExportPart {
  partReferenceNumber: string;
  partName: string;
  partExpirationTimestamp?: string;
}

export interface ExportDownloadParams {
  referenceNumber: string;
  partReferenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface UpoParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface UpoResult {
  upo: string;
  referenceNumber: string;
  processingCode: number;
  processingDescription: string;
}
