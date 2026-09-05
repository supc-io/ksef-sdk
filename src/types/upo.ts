import type { RequestOptions } from './common.js';

export interface SessionUpoParams {
  /** Session reference number. Defaults to the currently open session. */
  referenceNumber?: string;
  /** Reference number of the UPO page (from `sessions.status().upo.pages`). */
  upoReferenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface InvoiceUpoParams {
  /** Session reference number. Defaults to the currently open session. */
  referenceNumber?: string;
  invoiceReferenceNumber: string;
  requestOptions?: RequestOptions;
}

export interface KsefNumberUpoParams {
  /** Session reference number. Defaults to the currently open session. */
  referenceNumber?: string;
  ksefNumber: string;
  requestOptions?: RequestOptions;
}

export interface UpoDownloadParams {
  /** Pre-signed `upoDownloadUrl` / `downloadUrl` returned by status endpoints. */
  url: string;
  requestOptions?: RequestOptions;
}
