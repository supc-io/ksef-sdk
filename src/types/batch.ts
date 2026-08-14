import type { RequestOptions } from './common.js';

export interface BatchInitParams {
  requestOptions?: RequestOptions;
}

export interface BatchInitResult {
  referenceNumber: string;
  packageSignature: {
    packagePartSignatureList: PackagePartSignature[];
  };
  timestamp: string;
}

export interface PackagePartSignature {
  ordinalNumber: number;
  partFileName: string;
  partReferenceNumber: string;
  headerEntryList: BatchHeaderEntry[];
}

export interface BatchHeaderEntry {
  invoiceReferenceNumber: string;
  ksefReferenceNumber: string;
  invoiceNumber: string;
  invoicingDate: string;
}

export interface BatchSendParams {
  referenceNumber: string;
  partNumber: number;
  fileContent: Buffer | string;
  requestOptions?: RequestOptions;
}

export interface BatchSendResult {
  referenceNumber: string;
  timestamp: string;
}

export interface BatchFinishParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface BatchFinishResult {
  referenceNumber: string;
  timestamp: string;
}

export interface BatchStatusParams {
  referenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface BatchStatusResult {
  processingCode: number;
  processingDescription: string;
  referenceNumber: string;
  packageSignature?: BatchInitResult['packageSignature'];
  timestamp: string;
}
