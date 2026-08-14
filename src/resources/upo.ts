import { BaseResource } from './base-resource.js';
import type { UpoParams, UpoResult } from '../types/export.js';

export class UpoResource extends BaseResource {
  /**
   * Gets the UPO (official receipt) for a given reference number.
   */
  async get(params: UpoParams): Promise<UpoResult> {
    return this.requestJson<UpoResult>(
      'GET',
      `/common/Status/${params.referenceNumber}`,
      { requestOptions: params.requestOptions },
    );
  }
}
