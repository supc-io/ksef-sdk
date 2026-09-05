import { SessionError } from './errors/index.js';

export class SessionManager {
  private _sessionToken: string | null = null;
  private _referenceNumber: string | null = null;

  get sessionToken(): string | null {
    return this._sessionToken;
  }

  get referenceNumber(): string | null {
    return this._referenceNumber;
  }

  get isActive(): boolean {
    return this._sessionToken !== null;
  }

  setSession(token: string, referenceNumber: string): void {
    if (!token) {
      throw new SessionError('Cannot activate a session without a session token');
    }
    this._sessionToken = token;
    this._referenceNumber = referenceNumber;
  }

  clear(): void {
    this._sessionToken = null;
    this._referenceNumber = null;
  }

  requireToken(): string {
    if (this._sessionToken === null) {
      throw new SessionError('No active session. Call sessions.init() first.');
    }
    return this._sessionToken;
  }
}
