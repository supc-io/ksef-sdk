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
  /** Additional detail lines returned by KSeF (`exceptionDetailList[].details`, 429 `status.details`). */
  readonly details: string[];

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
    details: string[] = [],
  ) {
    super(message);
    this.name = 'KsefApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.headers = headers;
    this.details = details;
  }

  /**
   * Builds the right error subclass from a KSeF API 2.0 error response.
   * Understands `ExceptionResponse` (400), RFC 7807 problem details
   * (401/403/410, `application/problem+json`) and `TooManyRequestsResponse` (429).
   */
  static fromResponse(status: number, body: string, headers: Record<string, string>): KsefApiError {
    let message = `KSeF API error (${status})`;
    let code: string | null = null;
    let requestId: string | null = null;
    let details: string[] = [];

    try {
      const parsed = JSON.parse(body);
      const exceptionDetail = parsed.exception?.exceptionDetailList?.[0];

      if (exceptionDetail) {
        message = exceptionDetail.exceptionDescription || message;
        code =
          exceptionDetail.exceptionCode !== undefined && exceptionDetail.exceptionCode !== null
            ? String(exceptionDetail.exceptionCode)
            : null;
        details = toStringArray(exceptionDetail.details);
        requestId = parsed.exception.referenceNumber ?? null;
      } else if (typeof parsed.detail === 'string' || typeof parsed.title === 'string') {
        // RFC 7807 problem details
        message = parsed.detail || parsed.title;
        code = typeof parsed.reasonCode === 'string' ? parsed.reasonCode : null;
        requestId = parsed.traceId ?? null;
      } else if (parsed.status?.description) {
        // TooManyRequestsResponse
        details = toStringArray(parsed.status.details);
        message = details.length > 0 ? details.join(' ') : parsed.status.description;
      } else if (parsed.message) {
        message = parsed.message;
      }

      requestId = requestId ?? parsed.referenceNumber ?? parsed.requestId ?? null;
    } catch {
      if (body) message = body.slice(0, 500);
    }

    const ErrorClass = STATUS_MAP[status] ?? (status >= 500 ? ServerError : KsefApiError);
    return new ErrorClass(message, status, code, requestId, headers, details);
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export class AuthenticationError extends KsefApiError {
  constructor(
    message: string,
    status = 401,
    code: string | null = null,
    requestId: string | null = null,
    headers: Record<string, string> = {},
    details: string[] = [],
  ) {
    super(message, status, code, requestId, headers, details);
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
    details: string[] = [],
  ) {
    super(message, status, code, requestId, headers, details);
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
    details: string[] = [],
  ) {
    super(message, status, code, requestId, headers, details);
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
    details: string[] = [],
  ) {
    super(message, status, code, requestId, headers, details);
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
    details: string[] = [],
  ) {
    super(message, status, code, requestId, headers, details);
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
    details: string[] = [],
  ) {
    super(message, status, code, requestId, headers, details);
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
 * Thrown for authentication and session lifecycle problems: calling an
 * operation without authenticating or without an open session, an
 * authentication that KSeF rejected, or a status poll that timed out.
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
