import { readFileSync } from 'node:fs';
import { KsefClient } from './client.js';
import { DefaultHttpClient } from './http/default-http-client.js';
import { RetryHttpClient } from './http/retry.js';
import { ConfigurationError } from './errors/index.js';
import { validateNip, normalizeNip } from './utils/nip.js';
import { Mode, BASE_URLS } from './types/common.js';
import type { Logger, ClientConfig } from './types/common.js';
import type { HttpClient } from './http/http-client.js';

export class KsefClientBuilder {
  private _mode?: Mode;
  private _certificateBase64?: string;
  private _certificatePassword?: string;
  private _identifier?: string;
  private _logger?: Logger;
  private _timeout = 30000;
  private _maxRetries = 2;
  private _httpClient?: HttpClient;

  /**
   * Sets the KSeF environment mode.
   */
  mode(mode: Mode): this {
    this._mode = mode;
    return this;
  }

  /**
   * Sets the certificate from a base64-encoded PKCS#12 file.
   */
  certificate(certBase64: string, password: string): this {
    this._certificateBase64 = certBase64;
    this._certificatePassword = password;
    return this;
  }

  /**
   * Sets the certificate from a file path.
   */
  certificatePath(path: string, password: string): this {
    const content = readFileSync(path);
    this._certificateBase64 = content.toString('base64');
    this._certificatePassword = password;
    return this;
  }

  /**
   * Sets the NIP identifier.
   */
  identifier(nip: string): this {
    this._identifier = nip;
    return this;
  }

  /**
   * Sets a custom logger.
   */
  logger(logger: Logger): this {
    this._logger = logger;
    return this;
  }

  /**
   * Sets the request timeout in milliseconds.
   */
  timeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  /**
   * Sets the maximum number of retries for failed requests.
   */
  maxRetries(count: number): this {
    this._maxRetries = count;
    return this;
  }

  /**
   * Sets a custom HTTP client (for testing or custom implementations).
   */
  httpClient(client: HttpClient): this {
    this._httpClient = client;
    return this;
  }

  /**
   * Builds the KsefClient. Validates configuration and throws ConfigurationError if invalid.
   */
  build(): KsefClient {
    if (!this._mode) {
      throw new ConfigurationError('Mode is required. Use .mode(Mode.Test) or similar.');
    }

    if (!this._certificateBase64 || !this._certificatePassword) {
      throw new ConfigurationError(
        'Certificate is required. Use .certificate(base64, password) or .certificatePath(path, password).',
      );
    }

    if (!this._identifier) {
      throw new ConfigurationError(
        'Identifier (NIP) is required. Use .identifier("1234567890").',
      );
    }

    const nip = normalizeNip(this._identifier);
    if (!validateNip(nip)) {
      throw new ConfigurationError(`Invalid NIP: ${this._identifier}`);
    }

    const config: ClientConfig = {
      mode: this._mode,
      baseUrl: BASE_URLS[this._mode],
      identifier: nip,
      certificateBase64: this._certificateBase64,
      certificatePassword: this._certificatePassword,
      timeout: this._timeout,
      maxRetries: this._maxRetries,
      logger: this._logger,
    };

    const innerHttp = this._httpClient ?? new DefaultHttpClient();
    const httpClient = new RetryHttpClient(innerHttp, { maxRetries: this._maxRetries });

    return new KsefClient(httpClient, config);
  }
}
