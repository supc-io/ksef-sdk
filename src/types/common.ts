export enum Mode {
  Production = 'production',
  Demo = 'demo',
  Test = 'test',
}

/** KSeF API 2.0 base URLs (see https://github.com/CIRFMF/ksef-api/blob/main/srodowiska.md). */
export const BASE_URLS: Record<Mode, string> = {
  [Mode.Production]: 'https://api.ksef.mf.gov.pl/v2',
  [Mode.Demo]: 'https://api-demo.ksef.mf.gov.pl/v2',
  [Mode.Test]: 'https://api-test.ksef.mf.gov.pl/v2',
};

export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Invoice schema identifier used when opening a session. */
export interface FormCode {
  systemCode: string;
  schemaVersion: string;
  value: string;
}

/**
 * Invoice schemas supported by KSeF API 2.0. DEMO and production accept
 * FA (3), PEF (3) and PEF_KOR (3); FA (2) is only available on TEST.
 */
export const FormCodes = {
  FA2: { systemCode: 'FA (2)', schemaVersion: '1-0E', value: 'FA' },
  FA3: { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' },
  PEF3: { systemCode: 'PEF (3)', schemaVersion: '2-1', value: 'PEF' },
  PEF_KOR3: { systemCode: 'PEF_KOR (3)', schemaVersion: '2-1', value: 'PEF' },
  FA_RR1: { systemCode: 'FA_RR (1)', schemaVersion: '1-1E', value: 'FA_RR' },
} as const satisfies Record<string, FormCode>;

export interface ClientConfig {
  mode: Mode;
  baseUrl: string;
  identifier: string;
  certificateBase64: string;
  certificatePassword: string;
  timeout: number;
  maxRetries: number;
  logger?: Logger;
  validateXml?: boolean;
  xsdSchemaPath?: string;
  /** Invoice schema used by `sessions.open()` unless overridden per call. */
  formCode: FormCode;
  /**
   * Ask KSeF to verify the certificate chain (OCSP/CRL) during XAdES
   * authentication. Only meaningful on environments that accept
   * self-generated certificates (TEST).
   */
  verifyCertificateChain?: boolean;
}
