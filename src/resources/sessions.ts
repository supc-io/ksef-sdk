import { BaseResource } from './base-resource.js';
import type { SessionStatusResponse, SessionTerminateResponse } from '../types/session.js';
import type { SessionInitResult } from '../types/session.js';
import type { ClientConfig, RequestOptions } from '../types/common.js';
import type { HttpClient } from '../http/http-client.js';
import type { SessionManager } from '../session-manager.js';
import type { AuthResource } from './auth.js';
import { SessionError } from '../errors/index.js';
import { sleep, throwIfAborted } from '../utils/async.js';

const SESSION_POLL_INTERVAL_MS = 2000;
const SESSION_POLL_MAX_ATTEMPTS = 30;

export class SessionsResource extends BaseResource {
  constructor(
    httpClient: HttpClient,
    config: ClientConfig,
    sessionManager: SessionManager,
    private readonly auth: AuthResource,
  ) {
    super(httpClient, config, sessionManager);
  }

  /**
   * Initialises a KSeF session using certificate-based authentication.
   * Performs the full auth flow and polls until the session is active.
   */
  async init(options?: { requestOptions?: RequestOptions }): Promise<SessionInitResult> {
    const signal = options?.requestOptions?.signal;
    const initResult = await this.auth.initSigned({ requestOptions: options?.requestOptions });

    this.logger?.info(`Polling session status for ref: ${initResult.referenceNumber}`);

    // Poll for session to become active
    for (let attempt = 0; attempt < SESSION_POLL_MAX_ATTEMPTS; attempt++) {
      const status = await this.status({
        referenceNumber: initResult.referenceNumber,
        requestOptions: options?.requestOptions,
      });

      if (status.processingCode === 200) {
        const sessionToken = (
          status as SessionStatusResponse & { sessionToken?: { token?: string } }
        ).sessionToken?.token;

        if (!sessionToken) {
          throw new SessionError(
            `KSeF reported session ${initResult.referenceNumber} as active but the status response did not include a session token`,
          );
        }

        this.sessionManager.setSession(sessionToken, initResult.referenceNumber);
        this.logger?.info('Session is now active');

        return {
          referenceNumber: initResult.referenceNumber,
          sessionToken,
        };
      }

      if (status.processingCode >= 400) {
        throw new SessionError(
          `Session init failed: ${status.processingDescription} (code: ${status.processingCode})`,
        );
      }

      await sleep(SESSION_POLL_INTERVAL_MS, signal);
      throwIfAborted(signal);
    }

    throw new SessionError(
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
      `/online/Session/Status/${encodeURIComponent(params.referenceNumber)}`,
      {
        authenticated: false,
        requestOptions: params.requestOptions,
      },
    );
  }

  /**
   * Terminates the current active session. The local session is cleared on
   * success and when KSeF reports the token as no longer valid (HTTP 401).
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
