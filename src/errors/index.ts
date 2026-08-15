export class KsefError extends Error {
  constructor(message: string) {
    super(message);
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

  static fromResponse(
    status: number,
    body: string,
    headers: Record<string, string>,
  ): KsefApiError {
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

export class ValidationError extends KsefApiError {
  constructor(
    message: string,
    status = 422,
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

export class ConnectionError extends KsefError {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConnectionError';
    this.cause = cause;
  }
}

export class ConfigurationError extends KsefError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
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
  401: AuthenticationError,
  403: PermissionDeniedError,
  404: NotFoundError,
  422: ValidationError,
  429: RateLimitError,
};
