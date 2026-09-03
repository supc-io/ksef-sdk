import { BaseResource } from './base-resource.js';
import type {
  BatchInitParams,
  BatchInitResult,
  BatchSendParams,
  BatchSendResult,
  BatchFinishParams,
  BatchFinishResult,
  BatchStatusParams,
  BatchStatusResult,
} from '../types/batch.js';

export class BatchResource extends BaseResource {
  /**
   * Initialises a batch sending session.
   */
  async init(params?: BatchInitParams): Promise<BatchInitResult> {
    return this.requestJson<BatchInitResult>('POST', '/batch/Init', {
      body: {},
      requestOptions: params?.requestOptions,
    });
  }

  /**
   * Sends a part of a batch package.
   */
  async send(params: BatchSendParams): Promise<BatchSendResult> {
    const body = typeof params.fileContent === 'string' ? params.fileContent : params.fileContent;

    return this.requestJson<BatchSendResult>(
      'PUT',
      `/batch/Upload/${params.referenceNumber}/${params.partNumber}`,
      {
        body: { fileContent: Buffer.from(body).toString('base64') },
        requestOptions: params.requestOptions,
      },
    );
  }

  /**
   * Finishes a batch sending session.
   */
  async finish(params: BatchFinishParams): Promise<BatchFinishResult> {
    return this.requestJson<BatchFinishResult>('POST', `/batch/Finish/${params.referenceNumber}`, {
      body: {},
      requestOptions: params.requestOptions,
    });
  }

  /**
   * Gets the status of a batch operation.
   */
  async status(params: BatchStatusParams): Promise<BatchStatusResult> {
    return this.requestJson<BatchStatusResult>('GET', `/batch/Status/${params.referenceNumber}`, {
      requestOptions: params.requestOptions,
    });
  }
}
