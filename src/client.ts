import type { HttpClient } from './http/http-client.js';
import type { ClientConfig } from './types/common.js';
import { SessionManager } from './session-manager.js';
import { AuthResource } from './resources/auth.js';
import { SessionsResource } from './resources/sessions.js';
import { BatchResource } from './resources/batch.js';
import { InvoicesResource } from './resources/invoices.js';
import { UpoResource } from './resources/upo.js';
import { ExportsResource } from './resources/exports.js';
import { CertificatesResource } from './resources/certificates.js';
import { PermissionsResource } from './resources/permissions.js';
import { LimitsResource } from './resources/limits.js';

export class KsefClient {
  readonly auth: AuthResource;
  readonly sessions: SessionsResource;
  readonly batch: BatchResource;
  readonly invoices: InvoicesResource;
  readonly upo: UpoResource;
  readonly exports: ExportsResource;
  readonly certificates: CertificatesResource;
  readonly permissions: PermissionsResource;
  readonly limits: LimitsResource;

  private readonly sessionManager: SessionManager;

  constructor(
    httpClient: HttpClient,
    config: ClientConfig,
  ) {
    this.sessionManager = new SessionManager();

    this.auth = new AuthResource(httpClient, config, this.sessionManager);
    this.sessions = new SessionsResource(httpClient, config, this.sessionManager);
    this.batch = new BatchResource(httpClient, config, this.sessionManager);
    this.invoices = new InvoicesResource(httpClient, config, this.sessionManager);
    this.upo = new UpoResource(httpClient, config, this.sessionManager);
    this.exports = new ExportsResource(httpClient, config, this.sessionManager);
    this.certificates = new CertificatesResource(httpClient, config, this.sessionManager);
    this.permissions = new PermissionsResource(httpClient, config, this.sessionManager);
    this.limits = new LimitsResource(httpClient, config, this.sessionManager);
  }

  get isSessionActive(): boolean {
    return this.sessionManager.isActive;
  }
}
