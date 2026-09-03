import type { HttpClient, HttpMethod, HttpRequestConfig, HttpResponse } from './http-client.js';
import { ConnectionError, KsefError } from '../errors/index.js';
import { sleep, throwIfAborted } from '../utils/async.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_BASE_DELAY = 500;
const DEFAULT_MAX_DELAY = 30000;

/**
 * Methods that are safe to replay after a transport failure or 5xx response.
 * POST/PUT are not replayed on those conditions: a request that timed out may
 * already have been processed by KSeF (e.g. an invoice registered twice).
 */
function isIdempotent(method: HttpMethod): boolean {
  return method === 'GET' || method === 'DELETE';
}

/**
 * 429 and 503 explicitly mean "not processed, try later" and are retried for
 * every method. Other 5xx responses are only retried for idempotent requests.
 */
function isRetryableStatus(status: number, idempotent: boolean): boolean {
  if (status === 429 || status === 503) return true;
  return idempotent && status >= 500;
}

/**
 * Parses a `Retry-After` header (delay-seconds or HTTP-date) into milliseconds.
 * Returns `undefined` when the header is missing or unparsable.
 */
export function parseRetryAfter(
  value: string | undefined,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}

/** Exponential backoff with ±10% jitter, capped at `maxDelay`. */
export function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = exponential * 0.1 * (Math.random() * 2 - 1);
  return Math.min(Math.max(0, exponential + jitter), maxDelay);
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export class RetryHttpClient implements HttpClient {
  constructor(
    private readonly inner: HttpClient,
    private readonly config: RetryConfig,
  ) {}

  async request(reqConfig: HttpRequestConfig): Promise<HttpResponse> {
    const baseDelay = this.config.baseDelayMs ?? DEFAULT_BASE_DELAY;
    const maxDelay = this.config.maxDelayMs ?? DEFAULT_MAX_DELAY;
    const maxRetries = Math.max(0, this.config.maxRetries);
    const idempotent = isIdempotent(reqConfig.method);
    const signal = reqConfig.signal;

    for (let attempt = 0; ; attempt++) {
      throwIfAborted(signal);

      let response: HttpResponse;
      try {
        response = await this.inner.request(reqConfig);
      } catch (err) {
        const error = toError(err);
        const canRetry = idempotent && attempt < maxRetries && !signal?.aborted;

        if (!canRetry) {
          if (attempt > 0) {
            throw new ConnectionError(
              `Request failed after ${attempt + 1} attempts: ${error.message}`,
              error,
            );
          }
          if (error instanceof KsefError) throw error;
          throw new ConnectionError(`Network error: ${error.message}`, error);
        }

        await sleep(calculateDelay(attempt, baseDelay, maxDelay), signal);
        continue;
      }

      if (isRetryableStatus(response.status, idempotent) && attempt < maxRetries) {
        const retryAfter = parseRetryAfter(getHeader(response.headers, 'retry-after'));
        const delay = Math.min(
          retryAfter ?? calculateDelay(attempt, baseDelay, maxDelay),
          maxDelay,
        );
        await sleep(delay, signal);
        continue;
      }

      return response;
    }
  }
}
