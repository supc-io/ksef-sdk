import { describe, it, expect } from 'vitest';
import { KsefClientBuilder } from '../../src/client-builder.js';
import { KsefClient } from '../../src/client.js';
import { ConfigurationError } from '../../src/errors/index.js';
import { Mode, FormCodes } from '../../src/types/common.js';

// Fake cert base64 — builder validates NIP, not cert contents (cert is parsed at auth time)
const FAKE_CERT = Buffer.from('fake-p12-content').toString('base64');
const VALID_NIP = '1234563218';

describe('KsefClientBuilder', () => {
  it('builds a valid KsefClient', () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(FAKE_CERT, 'password')
      .identifier(VALID_NIP)
      .build();

    expect(client).toBeInstanceOf(KsefClient);
  });

  it('throws ConfigurationError when mode is missing', () => {
    expect(() =>
      new KsefClientBuilder().certificate(FAKE_CERT, 'password').identifier(VALID_NIP).build(),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when certificate is missing', () => {
    expect(() => new KsefClientBuilder().mode(Mode.Test).identifier(VALID_NIP).build()).toThrow(
      ConfigurationError,
    );
  });

  it('throws ConfigurationError when identifier is missing', () => {
    expect(() =>
      new KsefClientBuilder().mode(Mode.Test).certificate(FAKE_CERT, 'password').build(),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError for invalid NIP', () => {
    expect(() =>
      new KsefClientBuilder()
        .mode(Mode.Test)
        .certificate(FAKE_CERT, 'password')
        .identifier('1234567890')
        .build(),
    ).toThrow(ConfigurationError);
  });

  it('accepts an empty certificate password', () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(FAKE_CERT, '')
      .identifier(VALID_NIP)
      .build();

    expect(client).toBeInstanceOf(KsefClient);
  });

  it('throws ConfigurationError when the certificate file cannot be read', () => {
    expect(() => new KsefClientBuilder().certificatePath('/nonexistent/cert.p12', 'x')).toThrow(
      ConfigurationError,
    );
  });

  it('rejects negative maxRetries and non-positive timeouts', () => {
    const valid = () =>
      new KsefClientBuilder().mode(Mode.Test).certificate(FAKE_CERT, 'p').identifier(VALID_NIP);
    expect(() => valid().maxRetries(-1).build()).toThrow(ConfigurationError);
    expect(() => valid().timeout(0).build()).toThrow(ConfigurationError);
  });

  it('accepts NIP with dashes', () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(FAKE_CERT, 'password')
      .identifier('123-456-32-18')
      .build();

    expect(client).toBeInstanceOf(KsefClient);
  });

  it('supports fluent chaining', () => {
    const builder = new KsefClientBuilder();
    const result = builder
      .mode(Mode.Test)
      .certificate(FAKE_CERT, 'password')
      .identifier(VALID_NIP)
      .timeout(60000)
      .maxRetries(3);

    expect(result).toBe(builder);
  });

  it('throws ConfigurationError when validateXml is enabled without xsdSchemaPath', () => {
    expect(() =>
      new KsefClientBuilder()
        .mode(Mode.Test)
        .certificate(FAKE_CERT, 'password')
        .identifier(VALID_NIP)
        .validateXml()
        .build(),
    ).toThrow(ConfigurationError);
  });

  it('builds successfully when validateXml is enabled with xsdSchemaPath', () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(FAKE_CERT, 'password')
      .identifier(VALID_NIP)
      .validateXml()
      .xsdSchemaPath('/path/to/FA2.xsd')
      .build();

    expect(client).toBeInstanceOf(KsefClient);
  });

  it('exposes resource accessors on built client', () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(FAKE_CERT, 'password')
      .identifier(VALID_NIP)
      .build();

    expect(client.auth).toBeDefined();
    expect(client.security).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.invoices).toBeDefined();
    expect(client.upo).toBeDefined();
    expect(client.isAuthenticated).toBe(false);
    expect(client.isSessionActive).toBe(false);
    expect(client.currentSession).toBeNull();
  });

  it('accepts a form code and rejects malformed ones', () => {
    const valid = () =>
      new KsefClientBuilder().mode(Mode.Test).certificate(FAKE_CERT, 'p').identifier(VALID_NIP);
    expect(valid().formCode(FormCodes.FA2).build()).toBeInstanceOf(KsefClient);
    expect(() =>
      valid().formCode({ systemCode: '', schemaVersion: '1-0E', value: 'FA' }).build(),
    ).toThrow(ConfigurationError);
  });
});
