import { BaseResource } from './base-resource.js';
import type {
  ContextLimitParams,
  ContextLimitResult,
  SubjectLimitParams,
  SubjectLimitResult,
  RateLimitParams,
  RateLimitResult,
} from '../types/limit.js';

export class LimitsResource extends BaseResource {
  /**
   * Gets limits for the current session context.
   */
  async context(params?: ContextLimitParams): Promise<ContextLimitResult> {
    return this.requestJson<ContextLimitResult>(
      'GET',
      '/online/Limits/Context',
      { requestOptions: params?.requestOptions },
    );
  }

  /**
   * Gets limits for a specific subject (NIP).
   */
  async subject(params: SubjectLimitParams): Promise<SubjectLimitResult> {
    return this.requestJson<SubjectLimitResult>(
      'GET',
      `/online/Limits/Subject/${params.subjectNip}`,
      { requestOptions: params?.requestOptions },
    );
  }

  /**
   * Gets current rate limits.
   */
  async rate(params?: RateLimitParams): Promise<RateLimitResult> {
    return this.requestJson<RateLimitResult>(
      'GET',
      '/online/Limits/Rate',
      { requestOptions: params?.requestOptions },
    );
  }
}
