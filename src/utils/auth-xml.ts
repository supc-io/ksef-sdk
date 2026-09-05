import { buildXml } from './xml.js';
import type { SubjectIdentifierType } from '../types/auth.js';

export const AUTH_TOKEN_REQUEST_NS = 'http://ksef.mf.gov.pl/auth/token/2.0';

export interface AuthTokenRequestParams {
  challenge: string;
  /** NIP of the context the caller authenticates into. */
  nip: string;
  /** How KSeF identifies the signer: from certificate subject fields (default) or its fingerprint. */
  subjectIdentifierType?: SubjectIdentifierType;
}

/**
 * Builds the `AuthTokenRequest` document (schema auth v2.0) that is signed
 * with XAdES and sent to `POST /auth/xades-signature`.
 */
export function buildAuthTokenRequest(params: AuthTokenRequestParams): string {
  const body = buildXml({
    AuthTokenRequest: {
      '@_xmlns': AUTH_TOKEN_REQUEST_NS,
      Challenge: params.challenge,
      ContextIdentifier: {
        Nip: params.nip,
      },
      SubjectIdentifierType: params.subjectIdentifierType ?? 'certificateSubject',
    },
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
