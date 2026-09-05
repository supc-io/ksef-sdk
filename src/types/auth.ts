export interface AuthenticationChallengeResponse {
  challenge: string;
  timestamp: string;
  timestampMs: number;
  clientIp: string;
}

export interface TokenInfo {
  /** JWT. */
  token: string;
  /** ISO 8601 date-time. */
  validUntil: string;
}

export interface AuthenticationInitResponse {
  referenceNumber: string;
  authenticationToken: TokenInfo;
}

export interface StatusInfo {
  code: number;
  description: string;
  details?: string[] | null;
}

export interface AuthenticationMethodInfo {
  category: 'XadesSignature' | 'NationalNode' | 'Token' | 'Other' | string;
  code: string;
  displayName: string;
}

/**
 * Status of an authentication operation.
 * Codes: 100 in progress, 200 success, 415 no permissions, 425 revoked,
 * 450 token problem, 460 certificate problem, 470 IP policy violation.
 */
export interface AuthenticationStatusResponse {
  startDate: string;
  authenticationMethod?: string;
  authenticationMethodInfo: AuthenticationMethodInfo;
  status: StatusInfo;
  isTokenRedeemed?: boolean;
  lastUpdateDate?: string;
}

export interface AuthenticationTokensResponse {
  accessToken: TokenInfo;
  refreshToken: TokenInfo;
}

export interface AuthenticationRefreshResponse {
  accessToken: TokenInfo;
}

export type SubjectIdentifierType = 'certificateSubject' | 'certificateFingerprint';

export interface AuthenticateResult extends AuthenticationTokensResponse {
  /** Reference number of the authentication operation. */
  referenceNumber: string;
}
