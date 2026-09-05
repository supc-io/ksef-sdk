import { BaseResource } from './base-resource.js';
import type {
  InvoiceUpoParams,
  KsefNumberUpoParams,
  SessionUpoParams,
  UpoDownloadParams,
} from '../types/upo.js';

/**
 * UPO (Urzędowe Poświadczenie Odbioru) documents, returned as XML strings.
 */
export class UpoResource extends BaseResource {
  /** `GET /sessions/{ref}/upo/{upoReferenceNumber}`: the collective session UPO page. */
  async forSession(params: SessionUpoParams): Promise<string> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params.referenceNumber);
    return this.requestText(
      'GET',
      `/sessions/${encodeURIComponent(referenceNumber)}/upo/${encodeURIComponent(params.upoReferenceNumber)}`,
      { requestOptions: params.requestOptions },
    );
  }

  /** `GET /sessions/{ref}/invoices/{invoiceReferenceNumber}/upo` */
  async forInvoice(params: InvoiceUpoParams): Promise<string> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params.referenceNumber);
    return this.requestText(
      'GET',
      `/sessions/${encodeURIComponent(referenceNumber)}/invoices/${encodeURIComponent(params.invoiceReferenceNumber)}/upo`,
      { requestOptions: params.requestOptions },
    );
  }

  /** `GET /sessions/{ref}/invoices/ksef/{ksefNumber}/upo` */
  async forKsefNumber(params: KsefNumberUpoParams): Promise<string> {
    const referenceNumber = this.context.session.resolveReferenceNumber(params.referenceNumber);
    return this.requestText(
      'GET',
      `/sessions/${encodeURIComponent(referenceNumber)}/invoices/ksef/${encodeURIComponent(params.ksefNumber)}/upo`,
      { requestOptions: params.requestOptions },
    );
  }

  /**
   * Downloads a UPO from a pre-signed `upoDownloadUrl` / `downloadUrl`.
   * These links are public (no token) and do not count against API limits.
   */
  async download(params: UpoDownloadParams): Promise<string> {
    return this.requestText('GET', params.url, {
      auth: { type: 'none' },
      requestOptions: params.requestOptions,
    });
  }
}
