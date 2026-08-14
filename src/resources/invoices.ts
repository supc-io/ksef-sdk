import { BaseResource } from './base-resource.js';
import type {
  InvoiceSendParams,
  InvoiceSendResult,
  InvoiceStatusParams,
  InvoiceStatusResult,
  InvoiceQueryParams,
  InvoiceQueryResult,
  InvoiceDownloadParams,
} from '../types/invoice.js';

export class InvoicesResource extends BaseResource {
  /**
   * Sends an invoice XML to KSeF.
   * @param params - The invoice XML and optional request options.
   * @returns The send result with reference numbers.
   */
  async send(params: InvoiceSendParams): Promise<InvoiceSendResult> {
    return this.requestJson<InvoiceSendResult>('PUT', '/online/Invoice/Send', {
      body: { invoiceBody: { type: 'plain', invoiceBody: params.xml } },
      requestOptions: params.requestOptions,
    });
  }

  /**
   * Gets the processing status of a sent invoice.
   */
  async status(params: InvoiceStatusParams): Promise<InvoiceStatusResult> {
    return this.requestJson<InvoiceStatusResult>(
      'GET',
      `/online/Invoice/Status/${params.invoiceElementReferenceNumber}`,
      { requestOptions: params.requestOptions },
    );
  }

  /**
   * Queries invoices matching the given criteria.
   */
  async query(params: InvoiceQueryParams): Promise<InvoiceQueryResult> {
    const body = {
      queryCriteria: {
        subjectType: params.subjectType,
        type: params.type ?? 'incremental',
        invoicingDateFrom: params.invoicingDateFrom,
        invoicingDateTo: params.invoicingDateTo,
        ksefReferenceNumberList: params.ksefReferenceNumberList,
      },
      queryDetails: {
        pageSize: params.pageSize ?? 10,
        pageOffset: params.pageOffset ?? 0,
      },
    };

    return this.requestJson<InvoiceQueryResult>('POST', '/online/Query/Invoice/Sync', {
      body,
      requestOptions: params.requestOptions,
    });
  }

  /**
   * Downloads a specific invoice XML by its KSeF reference number.
   */
  async download(params: InvoiceDownloadParams): Promise<string> {
    const response = await this.requestRaw(
      'GET',
      `/online/Invoice/Get/${params.ksefReferenceNumber}`,
      {
        headers: { Accept: 'application/octet-stream' },
        requestOptions: params.requestOptions,
      },
    );
    return response.body;
  }
}
