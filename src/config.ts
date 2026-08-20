import type { FrappeSSOConfig, NormalizedFrappeSSOConfig } from './types';
import { FrappeSSOConfigError } from './errors';

const DEFAULT_BUTTON_LABEL = 'Login with Frappe';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 600_000;
const DEFAULT_SCOPE = ['openid'];

export { DEFAULT_BUTTON_LABEL, DEFAULT_TIMEOUT_MS };

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function requireNonEmptyString(value: string | undefined, field: string): string {
  if (!value || value.trim().length === 0) {
    throw new FrappeSSOConfigError(`Missing or empty required field: ${field}`);
  }
  return value;
}

/**
 * Validate and normalize the consumer-provided SSO configuration.
 *
 * Never throws messages containing secrets — validation errors reference
 * field names, not values.
 */
export function defineFrappeSSOConfig(
  input: FrappeSSOConfig,
): NormalizedFrappeSSOConfig {
  // Required string fields
  const baseUrlRaw = requireNonEmptyString(input.baseUrl, 'baseUrl');
  const clientId = requireNonEmptyString(input.clientId, 'clientId');
  const redirectUriRaw = requireNonEmptyString(input.redirectUri, 'redirectUri');

  // Remove trailing slash from baseUrl
  const baseUrl = baseUrlRaw.replace(/\/+$/, '');

  // Scope — default to ['openid'] only if caller omits it entirely.
  // An explicit empty array is a configuration error.
  const scope =
    input.scope !== undefined ? input.scope : [...DEFAULT_SCOPE];
  if (scope.length === 0) {
    throw new FrappeSSOConfigError('scope must contain at least one value');
  }

  // Button label
  const buttonLabelRaw = input.buttonLabel ?? DEFAULT_BUTTON_LABEL;
  if (buttonLabelRaw.trim().length === 0) {
    throw new FrappeSSOConfigError('buttonLabel must not be blank');
  }
  const buttonLabel = buttonLabelRaw;

  // Timeout
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
    throw new FrappeSSOConfigError('timeoutMs must be a positive number');
  }
  if (timeoutMs > MAX_TIMEOUT_MS) {
    throw new FrappeSSOConfigError(
      `timeoutMs must not exceed ${MAX_TIMEOUT_MS}ms`,
    );
  }

  // allowInsecureHttp
  const allowInsecureHttp = input.allowInsecureHttp ?? false;

  // URL validation
  if (!isAbsoluteUrl(baseUrl)) {
    throw new FrappeSSOConfigError('baseUrl must be a valid absolute URL');
  }
  if (!isAbsoluteUrl(redirectUriRaw)) {
    throw new FrappeSSOConfigError('redirectUri must be a valid absolute URL');
  }

  // HTTPS enforcement
  if (!allowInsecureHttp) {
    if (baseUrl.startsWith('http://')) {
      throw new FrappeSSOConfigError(
        'baseUrl must use HTTPS. Set allowInsecureHttp: true for local development.',
      );
    }
    if (redirectUriRaw.startsWith('http://')) {
      throw new FrappeSSOConfigError(
        'redirectUri must use HTTPS. Set allowInsecureHttp: true for local development.',
      );
    }
  }

  // Discovery endpoint
  const discoveryEndpoint =
    input.discoveryEndpoint ??
    `${baseUrl}/.well-known/openid-configuration`;

  return {
    baseUrl,
    clientId,
    clientSecret: input.clientSecret,
    redirectUri: redirectUriRaw,
    scope,
    authorizationEndpoint: input.authorizationEndpoint,
    tokenEndpoint: input.tokenEndpoint,
    userInfoEndpoint: input.userInfoEndpoint,
    discoveryEndpoint,
    usePkce: input.usePkce ?? true,
    allowInsecureHttp,
    timeoutMs,
    buttonLabel,
  };
}
