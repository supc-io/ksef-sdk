import type { HttpClient } from './http/http-client.js';
import type { ClientConfig } from './types/common.js';
import type { OpenSessionResult } from './types/session.js';
import type { ResourceContext } from './resources/base-resource.js';
import { TokenManager } from './auth/token-manager.js';
import { SessionManager } from './session-manager.js';
import { AuthResource } from './resources/auth.js';
import { SecurityResource } from './resources/security.js';
import { SessionsResource } from './resources/sessions.js';
import { InvoicesResource } from './resources/invoices.js';
import { UpoResource } from './resources/upo.js';

export class KsefClient {
  readonly auth: AuthResource;
  readonly security: SecurityResource;
  readonly sessions: SessionsResource;
  readonly invoices: InvoicesResource;
  readonly upo: UpoResource;

  private readonly tokenManager: TokenManager;
  private readonly sessionManager: SessionManager;

  constructor(httpClient: HttpClient, config: ClientConfig) {
    this.tokenManager = new TokenManager();
    this.sessionManager = new SessionManager();

    const context: ResourceContext = {
      httpClient,
      config,
      tokens: this.tokenManager,
      session: this.sessionManager,
    };

    this.auth = new AuthResource(context);
    context.refresher = this.auth;
    this.security = new SecurityResource(context);
    this.sessions = new SessionsResource(context, this.security);
    this.invoices = new InvoicesResource(context, this.sessions);
    this.upo = new UpoResource(context);
  }

  /** True once tokens were obtained via `auth.authenticate()` or `auth.useTokens()`. */
  get isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated;
  }

  /** True while an interactive session opened with `sessions.open()` is tracked. */
  get isSessionActive(): boolean {
    return this.sessionManager.isActive;
  }

  get currentSession(): OpenSessionResult | null {
    return this.sessions.current;
  }
}
