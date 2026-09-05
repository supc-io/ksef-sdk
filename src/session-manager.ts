import type { OnlineSession } from './types/session.js';
import { SessionError } from './errors/index.js';

/**
 * Holds the currently open interactive session together with the symmetric
 * key material needed to encrypt invoices sent within it.
 */
export class SessionManager {
  private _session: OnlineSession | null = null;

  get session(): OnlineSession | null {
    return this._session;
  }

  get referenceNumber(): string | null {
    return this._session?.referenceNumber ?? null;
  }

  get isActive(): boolean {
    return this._session !== null;
  }

  setSession(session: OnlineSession): void {
    if (!session.referenceNumber) {
      throw new SessionError('Cannot activate a session without a reference number');
    }
    if (session.symmetricKey.length !== 32 || session.initializationVector.length !== 16) {
      throw new SessionError('Session key material must be a 32-byte key and a 16-byte IV');
    }
    this._session = session;
  }

  clear(): void {
    this._session = null;
  }

  requireSession(): OnlineSession {
    if (this._session === null) {
      throw new SessionError('No open session. Call sessions.open() first.');
    }
    return this._session;
  }

  /** Resolves an explicit reference number or falls back to the open session. */
  resolveReferenceNumber(referenceNumber?: string): string {
    if (referenceNumber) return referenceNumber;
    return this.requireSession().referenceNumber;
  }
}
