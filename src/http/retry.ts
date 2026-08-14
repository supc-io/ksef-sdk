import type { HttpClient, HttpRequestConfig, HttpResponse } from './http-client.js';
import { ConnectionError } from '../errors/index.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_BASE_DELAY = 500;
const DEFAULT_MAX_DELAY = 30000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = delay * 0.1 * Math.random();
  return Math.min(delay + jitter, maxDelay);
}

export class RetryHttpClient implements HttpClient {
  constructor(
    private readonly inner: HttpClient,
    private readonly config: RetryConfig,
  ) {}

  async request(reqConfig: HttpRequestConfig): Promise<HttpResponse> {
    const baseDelay = this.config.baseDelayMs ?? DEFAULT_BASE_DELAY;
    const maxDelay = this.config.maxDelayMs ?? DEFAULT_MAX_DELAY;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.inner.request(reqConfig);

        if (isRetryableStatus(response.status) && attempt < this.config.maxRetries) {
          const retryAfter = response.headers['retry-after'];
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : calculateDelay(attempt, baseDelay, maxDelay);
          await sleep(delay);
          continue;
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.config.maxRetries) {
          const delay = calculateDelay(attempt, baseDelay, maxDelay);
          await sleep(delay);
          continue;
        }
      }
    }

    throw new ConnectionError(
      `Request failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      lastError,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
