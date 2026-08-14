import type { HttpClient, HttpRequestConfig, HttpResponse } from './http-client.js';
import { ConnectionError } from '../errors/index.js';

const DEFAULT_TIMEOUT = 30000;

export class DefaultHttpClient implements HttpClient {
  async request(config: HttpRequestConfig): Promise<HttpResponse> {
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (config.signal) {
      config.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.body ?? undefined,
        signal: controller.signal,
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return { status: response.status, headers, body };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ConnectionError(`Request timed out after ${timeout}ms`);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new ConnectionError(`Network error: ${message}`, err instanceof Error ? err : undefined);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
