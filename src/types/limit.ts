import type { RequestOptions } from './common.js';

export interface ContextLimitParams {
  requestOptions?: RequestOptions;
}

export interface ContextLimitResult {
  limitList: LimitEntry[];
}

export interface SubjectLimitParams {
  subjectNip: string;
  requestOptions?: RequestOptions;
}

export interface SubjectLimitResult {
  limitList: LimitEntry[];
}

export interface RateLimitParams {
  requestOptions?: RequestOptions;
}

export interface RateLimitResult {
  limitList: LimitEntry[];
}

export interface LimitEntry {
  limitType: string;
  limitValue: number;
  currentValue: number;
  resetTimestamp?: string;
}
