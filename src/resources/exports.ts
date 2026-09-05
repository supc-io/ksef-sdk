import { BaseResource } from './base-resource.js';
import type {
  ExportInitParams,
  ExportInitResult,
  ExportStatusParams,
  ExportStatusResult,
  ExportDownloadParams,
} from '../types/export.js';

export class ExportsResource extends BaseResource {
  /**
   * Initiates a bulk export of invoices for a date range.
   */
  async init(params: ExportInitParams): Promise<ExportInitResult> {
    return this.requestJson<ExportInitResult>('POST', '/online/Query/Invoice/Async/Init', {
      body: {
        queryCriteria: {
          type: 'range',
          invoicingDateFrom: params.dateFrom,
          invoicingDateTo: params.dateTo,
          subjectType: params.subjectType ?? 'subject1',
        },
      },
      requestOptions: params.requestOptions,
    });
  }

  /**
   * Checks the status of a bulk export.
   */
  async status(params: ExportStatusParams): Promise<ExportStatusResult> {
    return this.requestJson<ExportStatusResult>(
      'GET',
      `/online/Query/Invoice/Async/Status/${encodeURIComponent(params.referenceNumber)}`,
      { requestOptions: params.requestOptions },
    );
  }

  /**
   * Downloads a specific part of a completed export.
   * Export parts are binary (encrypted ZIP archives), so the raw bytes are returned.
   */
  async download(params: ExportDownloadParams): Promise<Buffer> {
    const response = await this.requestRaw(
      'GET',
      `/online/Query/Invoice/Async/Fetch/${encodeURIComponent(params.referenceNumber)}/${encodeURIComponent(params.partReferenceNumber)}`,
      {
        headers: { Accept: 'application/octet-stream' },
        requestOptions: params.requestOptions,
      },
    );
    return response.rawBody ?? Buffer.from(response.body, 'utf-8');
  }
}
