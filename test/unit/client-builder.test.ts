import { describe, it, expect } from 'vitest';
import { KsefClientBuilder } from '../../src/client-builder.js';
import { KsefClient } from '../../src/client.js';
import { ConfigurationError } from '../../src/errors/index.js';
import { Mode } from '../../src/types/common.js';

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
      new KsefClientBuilder()
        .certificate(FAKE_CERT, 'password')
        .identifier(VALID_NIP)
        .build(),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when certificate is missing', () => {
    expect(() =>
      new KsefClientBuilder()
        .mode(Mode.Test)
        .identifier(VALID_NIP)
        .build(),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when identifier is missing', () => {
    expect(() =>
      new KsefClientBuilder()
        .mode(Mode.Test)
        .certificate(FAKE_CERT, 'password')
        .build(),
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

  it('exposes resource accessors on built client', () => {
    const client = new KsefClientBuilder()
      .mode(Mode.Test)
      .certificate(FAKE_CERT, 'password')
      .identifier(VALID_NIP)
      .build();

    expect(client.auth).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.batch).toBeDefined();
    expect(client.invoices).toBeDefined();
    expect(client.upo).toBeDefined();
    expect(client.exports).toBeDefined();
    expect(client.certificates).toBeDefined();
    expect(client.permissions).toBeDefined();
    expect(client.limits).toBeDefined();
    expect(client.isSessionActive).toBe(false);
  });
});
