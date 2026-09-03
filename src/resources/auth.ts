import { BaseResource } from './base-resource.js';
import type { AuthorisationChallengeResponse, InitSignedResponse } from '../types/auth.js';
import type { RequestOptions } from '../types/common.js';
import { signXades } from '../utils/xades.js';
import { parsePkcs12 } from '../utils/certificate.js';
import { buildXml } from '../utils/xml.js';
import { randomUUID } from 'node:crypto';

export class AuthResource extends BaseResource {
  /**
   * Requests an authorisation challenge from KSeF.
   * This is the first step of the certificate-based auth flow.
   */
  async getChallenge(options?: {
    requestOptions?: RequestOptions;
  }): Promise<AuthorisationChallengeResponse> {
    return this.requestJson<AuthorisationChallengeResponse>(
      'POST',
      '/online/Session/AuthorisationChallenge',
      {
        body: {
          contextIdentifier: {
            type: 'onip',
            identifier: this.config.identifier,
          },
        },
        authenticated: false,
        requestOptions: options?.requestOptions,
      },
    );
  }

  /**
   * Performs the full certificate auth flow:
   * 1. Get challenge
   * 2. Sign challenge XML with XAdES
   * 3. Submit InitSigned
   * Returns the reference number for session status polling.
   */
  async initSigned(options?: { requestOptions?: RequestOptions }): Promise<InitSignedResponse> {
    this.logger?.info('Starting certificate authentication flow');

    // Step 1: Get challenge
    const challenge = await this.getChallenge({ requestOptions: options?.requestOptions });
    this.logger?.debug(`Got challenge: ${challenge.challenge}`);

    // Step 2: Parse certificate
    const parsed = parsePkcs12(this.config.certificateBase64, this.config.certificatePassword);

    // Step 3: Generate token
    const token = randomUUID();

    // Step 4: Build InitSigned XML
    const initXml = buildInitSignedXml(
      challenge.challenge,
      challenge.timestamp,
      this.config.identifier,
      token,
    );

    // Step 5: Sign with XAdES
    const signedXml = signXades({
      xml: initXml,
      privateKeyPem: parsed.privateKeyPem,
      certificatePem: parsed.certificatePem,
    });

    this.logger?.debug('Signed InitSigned XML with XAdES');

    // Step 6: Submit to KSeF
    const response = await this.requestJson<InitSignedResponse>(
      'POST',
      '/online/Session/InitSigned',
      {
        body: { xml: Buffer.from(signedXml).toString('base64') },
        authenticated: false,
        requestOptions: options?.requestOptions,
      },
    );

    this.logger?.info(`InitSigned submitted, ref: ${response.referenceNumber}`);
    return response;
  }
}

function buildInitSignedXml(
  challenge: string,
  timestamp: string,
  identifier: string,
  token: string,
): string {
  const obj = {
    InitSessionSignedRequest: {
      '@_xmlns': 'http://ksef.mf.gov.pl/schema/gtw/svc/online/types/2021/10/01/0001',
      Context: {
        Challenge: challenge,
        Identifier: {
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@_xsi:type': 'SubjectIdentifierByCompanyType',
          Identifier: identifier,
        },
        DocumentType: {
          Service: 'KSeF',
          FormCode: {
            SystemCode: 'FA (2)',
            SchemaVersion: '1-0E',
            TargetNamespace: 'http://crd.gov.pl/wzor/2023/06/29/12648/',
            Value: 'FA',
          },
        },
        Token: token,
      },
      Timestamp: timestamp,
    },
  };

  return buildXml(obj);
}
