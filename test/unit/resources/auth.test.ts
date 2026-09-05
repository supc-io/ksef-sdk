import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { AuthResource } from '../../../src/resources/auth.js';
import { AuthenticationError, SessionError } from '../../../src/errors/index.js';
import {
  createContext,
  json,
  router,
  validTokens,
  futureDate,
  authenticate,
} from '../../helpers/context.js';
import type { Handler } from '../../helpers/context.js';
import { createTestKeyMaterial, hasOpenssl } from '../../helpers/openssl.js';
import type { TestKeyMaterial } from '../../helpers/openssl.js';

const CHALLENGE = '20260903-CR-0123456789-ABCDEF0123-45';
const REF = '20260903-AU-0000000001-0000000001-01';

function authRoutes(
  statusCodes: number[],
  extra: Record<string, Handler> = {},
): Record<string, Handler> {
  let statusCall = 0;
  return {
    'POST /auth/challenge': () =>
      json(200, {
        challenge: CHALLENGE,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        clientIp: '1.2.3.4',
      }),
    'POST /auth/xades-signature': () =>
      json(202, {
        referenceNumber: REF,
        authenticationToken: { token: 'auth-token', validUntil: futureDate() },
      }),
    [`GET /auth/${REF}`]: () => {
      const code = statusCodes[Math.min(statusCall++, statusCodes.length - 1)];
      return json(200, {
        startDate: new Date().toISOString(),
        authenticationMethodInfo: {
          category: 'XadesSignature',
          code: 'QualifiedSignature',
          displayName: 'Podpis',
        },
        status:
          code === 415
            ? { code, description: 'Brak uprawnień', details: ['Brak przypisanych uprawnień'] }
            : { code, description: code === 200 ? 'OK' : 'W toku' },
      });
    },
    'POST /auth/token/redeem': () => json(200, validTokens()),
    ...extra,
  };
}

describe.skipIf(!hasOpenssl())('AuthResource.authenticate', () => {
  let material: TestKeyMaterial;

  beforeAll(() => {
    material = createTestKeyMaterial();
  });

  afterAll(() => {
    material.cleanup();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function build(routes: Record<string, Handler>, verifyCertificateChain?: boolean) {
    const ctx = createContext(router(routes), {
      certificateBase64: material.p12Base64,
      certificatePassword: material.password,
      verifyCertificateChain,
    });
    const auth = new AuthResource(ctx.context);
    ctx.context.refresher = auth;
    return { ctx, auth };
  }

  it('runs challenge → XAdES → status → redeem and stores the tokens', async () => {
    const { ctx, auth } = build(authRoutes([200]));

    const result = await auth.authenticate();

    expect(result.referenceNumber).toBe(REF);
    expect(result.accessToken.token).toBe('access-jwt');
    expect(ctx.tokens.requireAccessToken()).toBe('access-jwt');
    expect(auth.tokens?.refreshToken.token).toBe('refresh-jwt');

    const [challenge, xades, status, redeem] = ctx.http.requests;
    expect(challenge.headers?.Authorization).toBeUndefined();

    expect(xades.url).toBe('https://api-test.ksef.mf.gov.pl/v2/auth/xades-signature');
    expect(xades.headers?.['Content-Type']).toBe('application/xml');
    expect(xades.headers?.Authorization).toBeUndefined();
    const signedXml = String(xades.body);
    expect(signedXml).toContain('<AuthTokenRequest xmlns="http://ksef.mf.gov.pl/auth/token/2.0">');
    expect(signedXml).toContain(`<Challenge>${CHALLENGE}</Challenge>`);
    expect(signedXml).toContain('<Nip>1234563218</Nip>');
    expect(signedXml).toContain('<ds:Signature');
    expect(signedXml).toContain('SignedProperties');

    expect(status.headers?.Authorization).toBe('Bearer auth-token');
    expect(redeem.headers?.Authorization).toBe('Bearer auth-token');
  });

  it('adds verifyCertificateChain to the XAdES submission when configured', async () => {
    const { ctx, auth } = build(authRoutes([200]), true);
    await auth.authenticate();
    expect(ctx.http.requests[1].url).toContain('/auth/xades-signature?verifyCertificateChain=true');
  });

  it('keeps polling while the status is 100 and redeems on 200', async () => {
    vi.useFakeTimers();
    const { ctx, auth } = build(authRoutes([100, 100, 200]));

    const pending = auth.authenticate();
    await vi.advanceTimersByTimeAsync(2500);
    const result = await pending;

    expect(result.accessToken.token).toBe('access-jwt');
    const statusCalls = ctx.http.requests.filter((r) => r.url.endsWith(`/auth/${REF}`));
    expect(statusCalls).toHaveLength(3);
  });

  it('throws SessionError with details when KSeF rejects the authentication', async () => {
    const { ctx, auth } = build(authRoutes([415]));

    await expect(auth.authenticate()).rejects.toThrow(SessionError);
    await expect(auth.authenticate()).rejects.toThrow(
      /Brak uprawnień \(code 415\): Brak przypisanych uprawnień/,
    );
    expect(ctx.tokens.isAuthenticated).toBe(false);
    expect(ctx.http.requests.some((r) => r.url.endsWith('/auth/token/redeem'))).toBe(false);
  });

  it('parses the certificate only once per client', async () => {
    const { auth } = build(authRoutes([200]));
    const started = Date.now();
    await auth.authenticate();
    const firstDuration = Date.now() - started;
    const again = Date.now();
    await auth.authenticate();
    expect(Date.now() - again).toBeLessThanOrEqual(Math.max(firstDuration, 50));
  });
});

describe('AuthResource tokens', () => {
  it('refreshAccessToken uses the refresh token and de-duplicates concurrent calls', async () => {
    const ctx = createContext(
      router({
        'POST /auth/token/refresh': () =>
          json(200, { accessToken: { token: 'fresh', validUntil: futureDate() } }),
      }),
    );
    authenticate(ctx);
    const auth = new AuthResource(ctx.context);

    const [a, b] = await Promise.all([auth.refreshAccessToken(), auth.refreshAccessToken()]);

    expect(a.token).toBe('fresh');
    expect(b).toBe(a);
    expect(ctx.http.requests).toHaveLength(1);
    expect(ctx.http.requests[0].headers?.Authorization).toBe('Bearer refresh-jwt');
    expect(ctx.tokens.requireAccessToken()).toBe('fresh');
  });

  it('clears local state when the refresh token is rejected', async () => {
    const ctx = createContext(
      router({
        'POST /auth/token/refresh': () =>
          json(401, { title: 'Unauthorized', status: 401, detail: 'revoked' }),
      }),
    );
    authenticate(ctx);
    const auth = new AuthResource(ctx.context);

    await expect(auth.refreshAccessToken()).rejects.toThrow(AuthenticationError);
    expect(ctx.tokens.isAuthenticated).toBe(false);
  });

  it('revoke() calls DELETE /auth/sessions/current and forgets the tokens', async () => {
    const ctx = createContext(
      router({ 'DELETE /auth/sessions/current': () => json(204, undefined) }),
    );
    authenticate(ctx);
    const auth = new AuthResource(ctx.context);

    await auth.revoke();

    expect(ctx.http.requests[0].headers?.Authorization).toBe('Bearer access-jwt');
    expect(ctx.tokens.isAuthenticated).toBe(false);
    expect(auth.tokens).toBeNull();
  });

  it('useTokens() restores a persisted token pair', () => {
    const ctx = createContext(() => json(200, {}));
    const auth = new AuthResource(ctx.context);
    const tokens = validTokens();

    auth.useTokens(tokens);

    expect(ctx.tokens.requireAccessToken()).toBe('access-jwt');
    expect(auth.tokens).toEqual(tokens);
  });

  it('exposes the low-level steps for external signers', async () => {
    const ctx = createContext(
      router({
        'POST /auth/xades-signature': () =>
          json(202, {
            referenceNumber: 'r',
            authenticationToken: { token: 't', validUntil: futureDate() },
          }),
      }),
    );
    const auth = new AuthResource(ctx.context);

    const xml = auth.buildAuthTokenRequest(
      '20260903-CR-0123456789-ABCDEF0123-45',
      'certificateFingerprint',
    );
    expect(xml).toContain('certificateFingerprint');

    const init = await auth.submitXadesSignature({ signedXml: '<signed/>' });
    expect(init.referenceNumber).toBe('r');
    expect(ctx.http.requests[0].body).toBe('<signed/>');
  });
});
