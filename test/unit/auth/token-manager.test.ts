import { describe, it, expect } from 'vitest';
import {
  TokenManager,
  isTokenExpired,
  TOKEN_EXPIRY_SKEW_MS,
} from '../../../src/auth/token-manager.js';
import { SessionError } from '../../../src/errors/index.js';
import { futureDate, validTokens } from '../../helpers/context.js';

describe('isTokenExpired', () => {
  it('treats tokens as expired shortly before validUntil (skew)', () => {
    const now = Date.now();
    const token = {
      token: 't',
      validUntil: new Date(now + TOKEN_EXPIRY_SKEW_MS + 1000).toISOString(),
    };
    expect(isTokenExpired(token, now)).toBe(false);
    expect(isTokenExpired(token, now + 2000)).toBe(true);
  });

  it('never treats an unparsable validUntil as expired', () => {
    expect(isTokenExpired({ token: 't', validUntil: 'not-a-date' })).toBe(false);
  });
});

describe('TokenManager', () => {
  it('starts unauthenticated', () => {
    const tm = new TokenManager();
    expect(tm.isAuthenticated).toBe(false);
    expect(tm.accessToken).toBeNull();
    expect(tm.canRefresh()).toBe(false);
    expect(() => tm.requireAccessToken()).toThrow(SessionError);
    expect(() => tm.requireRefreshToken()).toThrow(SessionError);
  });

  it('stores and exposes tokens', () => {
    const tm = new TokenManager();
    const tokens = validTokens();
    tm.setTokens(tokens.accessToken, tokens.refreshToken);
    expect(tm.isAuthenticated).toBe(true);
    expect(tm.requireAccessToken()).toBe('access-jwt');
    expect(tm.requireRefreshToken()).toBe('refresh-jwt');
    expect(tm.isAccessTokenExpired()).toBe(false);
    expect(tm.canRefresh()).toBe(true);
  });

  it('rejects empty tokens', () => {
    const tm = new TokenManager();
    expect(() =>
      tm.setTokens({ token: '', validUntil: futureDate() }, validTokens().refreshToken),
    ).toThrow(SessionError);
    expect(() => tm.setAccessToken({ token: '', validUntil: futureDate() })).toThrow(SessionError);
  });

  it('reports expiry and refreshability', () => {
    const tm = new TokenManager();
    tm.setTokens(
      { token: 'a', validUntil: futureDate(-1000) },
      { token: 'r', validUntil: futureDate(-1000) },
    );
    expect(tm.isAccessTokenExpired()).toBe(true);
    expect(tm.canRefresh()).toBe(false);

    tm.setAccessToken({ token: 'a2', validUntil: futureDate() });
    expect(tm.isAccessTokenExpired()).toBe(false);
  });

  it('clear() forgets everything', () => {
    const tm = new TokenManager();
    const tokens = validTokens();
    tm.setTokens(tokens.accessToken, tokens.refreshToken);
    tm.clear();
    expect(tm.isAuthenticated).toBe(false);
    expect(tm.refreshToken).toBeNull();
  });
});
