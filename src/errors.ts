/**
 * Base error class for all sso-frappe errors.
 * Never contains secrets (client secret, tokens, authorization codes).
 */
export class FrappeSSOError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly endpoint?: string;

  constructor(
    message: string,
    options: {
      code: string;
      statusCode?: number;
      endpoint?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'FrappeSSOError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.endpoint = options.endpoint;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Configuration validation error. */
export class FrappeSSOConfigError extends FrappeSSOError {
  constructor(message: string) {
    super(message, { code: 'CONFIG_ERROR' });
    this.name = 'FrappeSSOConfigError';
  }
}

/** OAuth state mismatch / validation failure. */
export class FrappeSSOStateError extends FrappeSSOError {
  constructor(message: string) {
    super(message, { code: 'STATE_ERROR' });
    this.name = 'FrappeSSOStateError';
  }
}

/** Token exchange failure. */
export class FrappeSSOTokenError extends FrappeSSOError {
  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message, { code: 'TOKEN_ERROR', statusCode, endpoint });
    this.name = 'FrappeSSOTokenError';
  }
}

/** Userinfo / profile fetch failure. */
export class FrappeSSOProfileError extends FrappeSSOError {
  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message, { code: 'PROFILE_ERROR', statusCode, endpoint });
    this.name = 'FrappeSSOProfileError';
  }
}

/** Discovery / metadata fetch failure. */
export class FrappeSSODiscoveryError extends FrappeSSOError {
  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message, { code: 'DISCOVERY_ERROR', statusCode, endpoint });
    this.name = 'FrappeSSODiscoveryError';
  }
}
