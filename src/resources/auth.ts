import { BaseResource } from './base-resource.js';
import type { ResourceContext, TokenRefresher } from './base-resource.js';
import type {
  AuthenticateResult,
  AuthenticationChallengeResponse,
  AuthenticationInitResponse,
  AuthenticationRefreshResponse,
  AuthenticationStatusResponse,
  AuthenticationTokensResponse,
  SubjectIdentifierType,
  TokenInfo,
} from '../types/auth.js';
import type { RequestOptions } from '../types/common.js';
import { AuthenticationError, SessionError } from '../errors/index.js';
import { signXades } from '../utils/xades.js';
import { parsePkcs12 } from '../utils/certificate.js';
import type { ParsedCertificate } from '../utils/certificate.js';
import { buildAuthTokenRequest } from '../utils/auth-xml.js';
import { sleep, throwIfAborted } from '../utils/async.js';

const AUTH_POLL_INTERVAL_MS = 1000;
const AUTH_POLL_MAX_ATTEMPTS = 60;
const AUTH_STATUS_IN_PROGRESS = 100;
const AUTH_STATUS_SUCCESS = 200;

export interface AuthenticateParams {
  subjectIdentifierType?: SubjectIdentifierType;
  /** Overrides the client-level `verifyCertificateChain` setting. */
  verifyCertificateChain?: boolean;
  requestOptions?: RequestOptions;
}

export interface SubmitXadesSignatureParams {
  signedXml: string;
  verifyCertificateChain?: boolean;
  requestOptions?: RequestOptions;
}

export interface AuthenticationOperationParams {
  referenceNumber: string;
  /** `authenticationToken.token` returned by `submitXadesSignature()`. */
  authenticationToken: string;
  requestOptions?: RequestOptions;
}

/**
 * KSeF API 2.0 authentication (`/auth/*`).
 *
 * The typical flow is wrapped by `authenticate()`; the individual steps are
 * exposed for callers that sign the request externally (HSM, cloud signer).
 */
export class AuthResource extends BaseResource implements TokenRefresher {
  private parsedCertificate?: ParsedCertificate;
  private refreshInFlight?: Promise<TokenInfo>;

  constructor(context: ResourceContext) {
    super(context);
  }

  /** Current access/refresh tokens, e.g. for persisting between processes. */
  get tokens(): AuthenticationTokensResponse | null {
    const { accessToken, refreshToken } = this.context.tokens;
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  }

  /** Restores previously obtained tokens instead of authenticating again. */
  useTokens(tokens: AuthenticationTokensResponse): void {
    this.context.tokens.setTokens(tokens.accessToken, tokens.refreshToken);
  }

  /** Step 1: `POST /auth/challenge`. */
  async challenge(options?: {
    requestOptions?: RequestOptions;
  }): Promise<AuthenticationChallengeResponse> {
    return this.requestJson<AuthenticationChallengeResponse>('POST', '/auth/challenge', {
      auth: { type: 'none' },
      requestOptions: options?.requestOptions,
    });
  }

  /** Step 2: builds the `AuthTokenRequest` XML for the configured NIP. */
  buildAuthTokenRequest(challenge: string, subjectIdentifierType?: SubjectIdentifierType): string {
    return buildAuthTokenRequest({
      challenge,
      nip: this.config.identifier,
      subjectIdentifierType,
    });
  }

  /** Step 3: signs the `AuthTokenRequest` with the configured PKCS#12 certificate (XAdES-BES). */
  signAuthTokenRequest(xml: string): string {
    const certificate = this.getCertificate();
    return signXades({
      xml,
      privateKeyPem: certificate.privateKeyPem,
      certificatePem: certificate.certificatePem,
    });
  }

  /** Step 4: `POST /auth/xades-signature` (HTTP 202). */
  async submitXadesSignature(
    params: SubmitXadesSignatureParams,
  ): Promise<AuthenticationInitResponse> {
    const verifyCertificateChain =
      params.verifyCertificateChain ?? this.config.verifyCertificateChain;
    const response = await this.requestRaw('POST', '/auth/xades-signature', {
      body: params.signedXml,
      contentType: 'application/xml',
      headers: { Accept: 'application/json' },
      query: verifyCertificateChain === undefined ? undefined : { verifyCertificateChain },
      auth: { type: 'none' },
      requestOptions: params.requestOptions,
    });
    return JSON.parse(response.body) as AuthenticationInitResponse;
  }

  /** Step 5: `GET /auth/{referenceNumber}`, authenticated with the authentication token. */
  async status(params: AuthenticationOperationParams): Promise<AuthenticationStatusResponse> {
    return this.requestJson<AuthenticationStatusResponse>(
      'GET',
      `/auth/${encodeURIComponent(params.referenceNumber)}`,
      {
        auth: { type: 'bearer', token: params.authenticationToken },
        requestOptions: params.requestOptions,
      },
    );
  }

  /** Step 6: `POST /auth/token/redeem`; stores the returned tokens in the client. */
  async redeem(
    params: Omit<AuthenticationOperationParams, 'referenceNumber'>,
  ): Promise<AuthenticationTokensResponse> {
    const tokens = await this.requestJson<AuthenticationTokensResponse>(
      'POST',
      '/auth/token/redeem',
      {
        auth: { type: 'bearer', token: params.authenticationToken },
        requestOptions: params.requestOptions,
      },
    );
    this.context.tokens.setTokens(tokens.accessToken, tokens.refreshToken);
    this.logger?.info(`Authenticated; access token valid until ${tokens.accessToken.validUntil}`);
    return tokens;
  }

  /**
   * Full certificate-based authentication:
   * challenge → AuthTokenRequest → XAdES → submit → poll status → redeem tokens.
   */
  async authenticate(params?: AuthenticateParams): Promise<AuthenticateResult> {
    const requestOptions = params?.requestOptions;
    const signal = requestOptions?.signal;

    this.logger?.info('Starting KSeF authentication with XAdES signature');
    const challenge = await this.challenge({ requestOptions });
    const xml = this.buildAuthTokenRequest(challenge.challenge, params?.subjectIdentifierType);
    const signedXml = this.signAuthTokenRequest(xml);
    const init = await this.submitXadesSignature({
      signedXml,
      verifyCertificateChain: params?.verifyCertificateChain,
      requestOptions,
    });
    this.logger?.debug(`Authentication operation started, ref: ${init.referenceNumber}`);

    const authenticationToken = init.authenticationToken.token;

    for (let attempt = 0; attempt < AUTH_POLL_MAX_ATTEMPTS; attempt++) {
      const status = await this.status({
        referenceNumber: init.referenceNumber,
        authenticationToken,
        requestOptions,
      });

      if (status.status.code === AUTH_STATUS_SUCCESS) {
        const tokens = await this.redeem({ authenticationToken, requestOptions });
        return { ...tokens, referenceNumber: init.referenceNumber };
      }

      if (status.status.code !== AUTH_STATUS_IN_PROGRESS) {
        const details = status.status.details?.length
          ? `: ${status.status.details.join('; ')}`
          : '';
        throw new SessionError(
          `Authentication failed: ${status.status.description} (code ${status.status.code})${details}`,
        );
      }

      await sleep(AUTH_POLL_INTERVAL_MS, signal);
      throwIfAborted(signal);
    }

    throw new SessionError(
      `Authentication timed out after ${AUTH_POLL_MAX_ATTEMPTS} status checks (ref: ${init.referenceNumber})`,
    );
  }

  /**
   * `POST /auth/token/refresh`, authenticated with the refresh token.
   * Concurrent callers share one in-flight refresh.
   */
  async refreshAccessToken(requestOptions?: RequestOptions): Promise<TokenInfo> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh(requestOptions).finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  private async doRefresh(requestOptions?: RequestOptions): Promise<TokenInfo> {
    const refreshToken = this.context.tokens.requireRefreshToken();
    try {
      const response = await this.requestJson<AuthenticationRefreshResponse>(
        'POST',
        '/auth/token/refresh',
        {
          auth: { type: 'bearer', token: refreshToken },
          requestOptions,
        },
      );
      this.context.tokens.setAccessToken(response.accessToken);
      this.logger?.debug(`Access token refreshed; valid until ${response.accessToken.validUntil}`);
      return response.accessToken;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        this.context.tokens.clear();
        this.context.session.clear();
        this.logger?.warn('Refresh token rejected by KSeF; local tokens and session cleared');
      }
      throw err;
    }
  }

  /**
   * `DELETE /auth/sessions/current`: invalidates the refresh token on the
   * server side (access tokens stay valid until they expire) and clears local state.
   */
  async revoke(options?: { requestOptions?: RequestOptions }): Promise<void> {
    await this.requestRaw('DELETE', '/auth/sessions/current', {
      requestOptions: options?.requestOptions,
    });
    this.context.tokens.clear();
    this.context.session.clear();
    this.logger?.info('Authentication session revoked');
  }

  /** Parses the configured PKCS#12 once and caches it for the lifetime of the client. */
  private getCertificate(): ParsedCertificate {
    if (!this.parsedCertificate) {
      this.parsedCertificate = parsePkcs12(
        this.config.certificateBase64,
        this.config.certificatePassword,
      );
    }
    return this.parsedCertificate;
  }
}
