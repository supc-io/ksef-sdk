export class KsefError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'KsefError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KsefApiError extends KsefError {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly headers: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'KsefApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.headers = headers;
  }

  static fromResponse(status: number, body: string, headers: Record<string, string>): KsefApiError {
    let message = `KSeF API error (${status})`;
    let code: string | null = null;
    let requestId: string | null = null;

    try {
      const parsed = JSON.parse(body);
      if (parsed.exception?.exceptionDetailList?.[0]) {
        const detail = parsed.exception.exceptionDetailList[0];
        message = detail.exceptionDescription || message;
        code = String(detail.exceptionCode ?? '') || null;
      } else if (parsed.message) {
        message = parsed.message;
      }
      requestId = parsed.referenceNumber ?? parsed.requestId ?? null;
    } catch {
      if (body) message = body.slice(0, 500);
    }

    const ErrorClass = STATUS_MAP[status] ?? (status >= 500 ? ServerError : KsefApiError);
    return new ErrorClass(message, status, code, requestId, headers);
  }
}

export class AuthenticationError extends KsefApiError {
  constructor(
    message: string,
    status = 401,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message, status, code, requestId, headers);
    this.name = 'AuthenticationError';
  }
}

export class PermissionDeniedError extends KsefApiError {
  constructor(
    message: string,
    status = 403,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message, status, code, requestId, headers);
    this.name = 'PermissionDeniedError';
  }
}

export class NotFoundError extends KsefApiError {
  constructor(
    message: string,
    status = 404,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message, status, code, requestId, headers);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown for HTTP 400 and 422 responses. KSeF reports invoice and request
 * validation failures as HTTP 400 with an `exception.exceptionDetailList` body,
 * so both status codes map here.
 */
export class ValidationError extends KsefApiError {
  constructor(
    message: string,
    status = 400,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message, status, code, requestId, headers);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends KsefApiError {
  constructor(
    message: string,
    status = 429,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message, status, code, requestId, headers);
    this.name = 'RateLimitError';
  }
}

export class ServerError extends KsefApiError {
  constructor(
    message: string,
    status = 500,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
  ) {
    super(message, status, code, requestId, headers);
    this.name = 'ServerError';
  }
}

/**
 * Thrown for transport-level failures: timeouts, DNS/connection errors,
 * caller-initiated aborts and exhausted retries.
 */
export class ConnectionError extends KsefError {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConnectionError';
    this.cause = cause;
  }
}

/**
 * Thrown for problems with the local configuration or environment:
 * missing builder options, unreadable or unparsable certificates,
 * missing `openssl` / `xmllint` binaries, invalid XSD schema files.
 */
export class ConfigurationError extends KsefError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Thrown for session lifecycle problems: calling an authenticated operation
 * without an active session, or a session initialisation that failed or timed out.
 */
export class SessionError extends KsefError {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export interface XsdValidationDetail {
  line: number;
  message: string;
}

export class XsdValidationError extends KsefError {
  readonly details: XsdValidationDetail[];

  constructor(message: string, details: XsdValidationDetail[]) {
    super(message);
    this.name = 'XsdValidationError';
    this.details = details;
  }
}

const STATUS_MAP: Record<number, typeof KsefApiError> = {
  400: ValidationError,
  401: AuthenticationError,
  403: PermissionDeniedError,
  404: NotFoundError,
  422: ValidationError,
  429: RateLimitError,
};
