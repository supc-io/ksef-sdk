import type { TokenInfo } from '../types/auth.js';
import { SessionError } from '../errors/index.js';

/** Tokens are treated as expired this many milliseconds before `validUntil`. */
export const TOKEN_EXPIRY_SKEW_MS = 30_000;

export function isTokenExpired(
  token: TokenInfo,
  now = Date.now(),
  skewMs = TOKEN_EXPIRY_SKEW_MS,
): boolean {
  const validUntil = Date.parse(token.validUntil);
  if (Number.isNaN(validUntil)) return false;
  return validUntil - skewMs <= now;
}

/**
 * Holds the JWT access/refresh token pair obtained from `POST /auth/token/redeem`.
 */
export class TokenManager {
  private _accessToken: TokenInfo | null = null;
  private _refreshToken: TokenInfo | null = null;

  get accessToken(): TokenInfo | null {
    return this._accessToken;
  }

  get refreshToken(): TokenInfo | null {
    return this._refreshToken;
  }

  /** True when an access token is present (it may still need refreshing). */
  get isAuthenticated(): boolean {
    return this._accessToken !== null;
  }

  setTokens(accessToken: TokenInfo, refreshToken: TokenInfo): void {
    if (!accessToken?.token || !refreshToken?.token) {
      throw new SessionError('Cannot store empty authentication tokens');
    }
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
  }

  setAccessToken(accessToken: TokenInfo): void {
    if (!accessToken?.token) {
      throw new SessionError('Cannot store an empty access token');
    }
    this._accessToken = accessToken;
  }

  clear(): void {
    this._accessToken = null;
    this._refreshToken = null;
  }

  isAccessTokenExpired(now = Date.now()): boolean {
    return this._accessToken === null || isTokenExpired(this._accessToken, now);
  }

  canRefresh(now = Date.now()): boolean {
    return this._refreshToken !== null && !isTokenExpired(this._refreshToken, now);
  }

  requireAccessToken(): string {
    if (this._accessToken === null) {
      throw new SessionError('Not authenticated. Call auth.authenticate() first.');
    }
    return this._accessToken.token;
  }

  requireRefreshToken(): string {
    if (this._refreshToken === null) {
      throw new SessionError('No refresh token available. Call auth.authenticate() first.');
    }
    return this._refreshToken.token;
  }
}
