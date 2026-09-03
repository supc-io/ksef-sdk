import { BaseResource } from './base-resource.js';
import type { SessionStatusResponse, SessionTerminateResponse } from '../types/session.js';
import type { SessionInitResult } from '../types/session.js';
import type { RequestOptions } from '../types/common.js';
import { AuthResource } from './auth.js';

const SESSION_POLL_INTERVAL_MS = 2000;
const SESSION_POLL_MAX_ATTEMPTS = 30;

export class SessionsResource extends BaseResource {
  /**
   * Initialises a KSeF session using certificate-based authentication.
   * Performs the full auth flow and polls until the session is active.
   */
  async init(options?: { requestOptions?: RequestOptions }): Promise<SessionInitResult> {
    const auth = new AuthResource(this.httpClient, this.config, this.sessionManager);
    const initResult = await auth.initSigned({ requestOptions: options?.requestOptions });

    this.logger?.info(`Polling session status for ref: ${initResult.referenceNumber}`);

    // Poll for session to become active
    for (let attempt = 0; attempt < SESSION_POLL_MAX_ATTEMPTS; attempt++) {
      const status = await this.status({
        referenceNumber: initResult.referenceNumber,
        requestOptions: options?.requestOptions,
      });

      if (status.processingCode === 200) {
        // Session is active — extract session token from response
        const sessionToken =
          (status as SessionStatusResponse & { sessionToken?: { token?: string } }).sessionToken
            ?.token ?? '';

        this.sessionManager.setSession(sessionToken, initResult.referenceNumber);
        this.logger?.info('Session is now active');

        return {
          referenceNumber: initResult.referenceNumber,
          sessionToken,
        };
      }

      if (status.processingCode >= 400) {
        throw new Error(
          `Session init failed: ${status.processingDescription} (code: ${status.processingCode})`,
        );
      }

      await sleep(SESSION_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Session init timed out after ${SESSION_POLL_MAX_ATTEMPTS} attempts for ref: ${initResult.referenceNumber}`,
    );
  }

  /**
   * Gets the status of a session by reference number.
   */
  async status(params: {
    referenceNumber: string;
    requestOptions?: RequestOptions;
  }): Promise<SessionStatusResponse> {
    return this.requestJson<SessionStatusResponse>(
      'GET',
      `/online/Session/Status/${params.referenceNumber}`,
      {
        authenticated: false,
        requestOptions: params.requestOptions,
      },
    );
  }

  /**
   * Terminates the current active session.
   */
  async terminate(options?: {
    requestOptions?: RequestOptions;
  }): Promise<SessionTerminateResponse> {
    const result = await this.requestJson<SessionTerminateResponse>(
      'GET',
      '/online/Session/Terminate',
      { requestOptions: options?.requestOptions },
    );
    this.sessionManager.clear();
    this.logger?.info('Session terminated');
    return result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
