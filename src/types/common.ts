export enum Mode {
  Production = 'production',
  Demo = 'demo',
  Test = 'test',
}

export const BASE_URLS: Record<Mode, string> = {
  [Mode.Production]: 'https://ksef.mf.gov.pl/api',
  [Mode.Demo]: 'https://ksef-demo.mf.gov.pl/api',
  [Mode.Test]: 'https://ksef-test.mf.gov.pl/api',
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
}
