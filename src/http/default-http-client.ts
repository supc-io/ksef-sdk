import type { HttpClient, HttpRequestConfig, HttpResponse } from './http-client.js';
import { ConnectionError } from '../errors/index.js';

const DEFAULT_TIMEOUT = 30000;

export class DefaultHttpClient implements HttpClient {
  async request(config: HttpRequestConfig): Promise<HttpResponse> {
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    if (config.signal?.aborted) {
      throw new ConnectionError('Request aborted by caller');
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    const onAbort = (): void => controller.abort();
    config.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: toBodyInit(config.body),
        signal: controller.signal,
      });

      const rawBody = Buffer.from(await response.arrayBuffer());
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return { status: response.status, headers, body: rawBody.toString('utf-8'), rawBody };
    } catch (err) {
      const cause = err instanceof Error ? err : undefined;

      if (isAbortError(err)) {
        if (config.signal?.aborted) {
          throw new ConnectionError('Request aborted by caller', cause);
        }
        if (timedOut) {
          throw new ConnectionError(`Request timed out after ${timeout}ms`, cause);
        }
      }

      throw new ConnectionError(`Network error: ${describeError(err)}`, cause);
    } finally {
      clearTimeout(timeoutId);
      config.signal?.removeEventListener('abort', onAbort);
    }
  }
}

function toBodyInit(body: string | Buffer | undefined): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return body;
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as BodyInit;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  // Node's fetch wraps socket errors as `TypeError: fetch failed` with the
  // actual reason (ECONNREFUSED, ENOTFOUND, ...) on `cause`.
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  if (cause?.code) return `${err.message} (${cause.code})`;
  if (cause?.message) return `${err.message} (${cause.message})`;
  return err.message;
}
