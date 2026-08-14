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
      `/online/Query/Invoice/Async/Status/${params.referenceNumber}`,
      { requestOptions: params.requestOptions },
    );
  }

  /**
   * Downloads a specific part of a completed export.
   */
  async download(params: ExportDownloadParams): Promise<string> {
    const response = await this.requestRaw(
      'GET',
      `/online/Query/Invoice/Async/Fetch/${params.referenceNumber}/${params.partReferenceNumber}`,
      {
        headers: { Accept: 'application/octet-stream' },
        requestOptions: params.requestOptions,
      },
    );
    return response.body;
  }
}
