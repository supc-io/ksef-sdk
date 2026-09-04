import { describe, it, expect } from 'vitest';
import {
  KsefError,
  KsefApiError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  ConnectionError,
  ConfigurationError,
  SessionError,
} from '../../src/errors/index.js';

describe('KsefError hierarchy', () => {
  it('KsefError is instance of Error', () => {
    const err = new KsefError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KsefError);
    expect(err.name).toBe('KsefError');
    expect(err.message).toBe('test');
  });

  it('KsefApiError carries status and metadata', () => {
    const err = new KsefApiError('bad request', 400, 'BAD_REQ', 'req-123', { 'x-id': '1' });
    expect(err).toBeInstanceOf(KsefError);
    expect(err).toBeInstanceOf(KsefApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQ');
    expect(err.requestId).toBe('req-123');
    expect(err.headers).toEqual({ 'x-id': '1' });
  });

  it.each([
    [400, ValidationError],
    [401, AuthenticationError],
    [403, PermissionDeniedError],
    [404, NotFoundError],
    [422, ValidationError],
    [429, RateLimitError],
    [500, ServerError],
    [502, ServerError],
    [503, ServerError],
  ])('fromResponse(%i) returns correct subclass', (status, ErrorClass) => {
    const err = KsefApiError.fromResponse(status, JSON.stringify({ message: 'test error' }), {});
    expect(err).toBeInstanceOf(ErrorClass);
    expect(err.status).toBe(status);
  });

  it('fromResponse parses KSeF exception format', () => {
    const body = JSON.stringify({
      exception: {
        exceptionDetailList: [{ exceptionCode: 12345, exceptionDescription: 'Session expired' }],
      },
      referenceNumber: 'ref-001',
    });
    const err = KsefApiError.fromResponse(401, body, {});
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Session expired');
    expect(err.code).toBe('12345');
    expect(err.requestId).toBe('ref-001');
  });

  it('fromResponse handles non-JSON body', () => {
    const err = KsefApiError.fromResponse(500, 'Internal Server Error', {});
    expect(err).toBeInstanceOf(ServerError);
    expect(err.message).toBe('Internal Server Error');
  });

  it('ConnectionError carries cause', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new ConnectionError('Network error', cause);
    expect(err).toBeInstanceOf(KsefError);
    expect(err.name).toBe('ConnectionError');
    expect(err.cause).toBe(cause);
  });

  it('maps KSeF invoice validation failures (HTTP 400 with exception details) to ValidationError', () => {
    const body = JSON.stringify({
      exception: {
        exceptionDetailList: [
          { exceptionCode: 21101, exceptionDescription: 'Błąd walidacji faktury' },
        ],
      },
    });
    const err = KsefApiError.fromResponse(400, body, {});
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('21101');
    expect(err.message).toBe('Błąd walidacji faktury');
  });

  it('fromResponse parses KSeF 2.0 ExceptionResponse with details and reference number', () => {
    const body = JSON.stringify({
      exception: {
        exceptionDetailList: [
          {
            exceptionCode: 21301,
            exceptionDescription: 'Nieprawidłowy skrót',
            details: ['a', 'b'],
          },
        ],
        referenceNumber: 'ref-2',
        serviceCode: 'x',
      },
    });
    const err = KsefApiError.fromResponse(400, body, {});
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe('21301');
    expect(err.requestId).toBe('ref-2');
    expect(err.details).toEqual(['a', 'b']);
  });

  it('fromResponse parses RFC 7807 problem details (401/403/410)', () => {
    const err = KsefApiError.fromResponse(
      403,
      JSON.stringify({
        title: 'Forbidden',
        status: 403,
        detail: 'Brak uprawnień',
        reasonCode: 'missing-permissions',
        traceId: 'trace-1',
      }),
      {},
    );
    expect(err).toBeInstanceOf(PermissionDeniedError);
    expect(err.message).toBe('Brak uprawnień');
    expect(err.code).toBe('missing-permissions');
    expect(err.requestId).toBe('trace-1');

    const titleOnly = KsefApiError.fromResponse(
      401,
      JSON.stringify({ title: 'Unauthorized', status: 401 }),
      {},
    );
    expect(titleOnly.message).toBe('Unauthorized');
  });

  it('fromResponse parses TooManyRequestsResponse', () => {
    const err = KsefApiError.fromResponse(
      429,
      JSON.stringify({
        status: {
          code: 429,
          description: 'Too Many Requests',
          details: ['Limit 20/min', 'Spróbuj za 30 s'],
        },
      }),
      { 'retry-after': '30' },
    );
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.message).toBe('Limit 20/min Spróbuj za 30 s');
    expect(err.details).toHaveLength(2);
  });

  it('SessionError is a KsefError', () => {
    const err = new SessionError('No active session');
    expect(err).toBeInstanceOf(KsefError);
    expect(err.name).toBe('SessionError');
  });

  it('KsefError carries an optional cause', () => {
    const cause = new SyntaxError('bad json');
    const err = new KsefError('wrapped', { cause });
    expect(err.cause).toBe(cause);
  });

  it('ConfigurationError is a KsefError', () => {
    const err = new ConfigurationError('Missing NIP');
    expect(err).toBeInstanceOf(KsefError);
    expect(err.name).toBe('ConfigurationError');
  });
});
