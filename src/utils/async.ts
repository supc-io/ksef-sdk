import { ConnectionError } from '../errors/index.js';

/**
 * Resolves after `ms` milliseconds, or immediately once `signal` is aborted.
 * Callers that care about cancellation should call `throwIfAborted` afterwards.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ConnectionError('Request aborted by caller');
  }
}
