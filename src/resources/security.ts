import { BaseResource } from './base-resource.js';
import type { PublicKeyCertificate } from '../types/security.js';
import type { RequestOptions } from '../types/common.js';
import { KsefError } from '../errors/index.js';

const CERTIFICATE_CACHE_TTL_MS = 60 * 60 * 1000;

/** `GET /security/public-key-certificates` with a one-hour cache. */
export class SecurityResource extends BaseResource {
  private cache?: { fetchedAt: number; certificates: PublicKeyCertificate[] };

  async publicKeyCertificates(options?: {
    requestOptions?: RequestOptions;
    /** Bypass the cache. */
    fresh?: boolean;
  }): Promise<PublicKeyCertificate[]> {
    const now = Date.now();
    if (!options?.fresh && this.cache && now - this.cache.fetchedAt < CERTIFICATE_CACHE_TTL_MS) {
      return this.cache.certificates;
    }

    const certificates = await this.requestJson<PublicKeyCertificate[]>(
      'GET',
      '/security/public-key-certificates',
      {
        auth: { type: 'none' },
        requestOptions: options?.requestOptions,
      },
    );
    this.cache = { fetchedAt: now, certificates };
    return certificates;
  }

  /** The currently valid MF certificate used to encrypt session symmetric keys. */
  async symmetricKeyEncryptionCertificate(options?: {
    requestOptions?: RequestOptions;
  }): Promise<PublicKeyCertificate> {
    const now = Date.now();
    const isUsable = (certificate: PublicKeyCertificate): boolean =>
      certificate.usage.includes('SymmetricKeyEncryption') &&
      Date.parse(certificate.validFrom) <= now &&
      Date.parse(certificate.validTo) >= now;

    let certificates = await this.publicKeyCertificates(options);
    let match = certificates.find(isUsable);

    if (!match && this.cache) {
      certificates = await this.publicKeyCertificates({ ...options, fresh: true });
      match = certificates.find(isUsable);
    }

    if (!match) {
      throw new KsefError(
        'KSeF did not return a valid public key certificate for symmetric key encryption',
      );
    }
    return match;
  }
}
