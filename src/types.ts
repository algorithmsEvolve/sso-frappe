/**
 * OAuth2/OIDC metadata advertised by a Frappe provider's
 * `/.well-known/openid-configuration` endpoint.
 */
export interface FrappeProviderMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  code_challenge_methods_supported?: string[];
}

/**
 * Raw input configuration provided by the consumer.
 */
export interface FrappeSSOConfig {
  /** Base URL of the Frappe website, e.g. `https://erp.example.com`. */
  baseUrl: string;
  /** Explicit issuer override. Use when Frappe's discovery returns a different issuer (e.g. http vs https). */
  issuer?: string;
  /** OAuth Client ID created in the Frappe provider. */
  clientId: string;
  /** OAuth Client Secret. Required for confidential (server-side) clients. */
  clientSecret?: string;
  /** Consumer callback URL, e.g. `https://app.example.com/api/auth/callback/frappe`. */
  redirectUri: string;
  /** OAuth scopes to request, e.g. `['openid']`. Defaults to `['openid']` if omitted. */
  scope?: readonly string[];
  /** Explicit authorization endpoint override (skip discovery). */
  authorizationEndpoint?: string;
  /** Explicit token endpoint override (skip discovery). */
  tokenEndpoint?: string;
  /** Explicit userinfo endpoint override. */
  userInfoEndpoint?: string;
  /** Explicit OIDC discovery URL override. Defaults to `${baseUrl}/.well-known/openid-configuration`. */
  discoveryEndpoint?: string;
  /** Enable PKCE S256. Defaults to `true`. */
  usePkce?: boolean;
  /** Allow non-HTTPS URLs for local development. Defaults to `false`. */
  allowInsecureHttp?: boolean;
  /** HTTP timeout in milliseconds. Defaults to `10000`. */
  timeoutMs?: number;
  /** Login button label. Defaults to `Login with Frappe`. */
  buttonLabel?: string;
}

export interface NormalizedFrappeSSOConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string | undefined;
  redirectUri: string;
  scope: readonly string[];
  authorizationEndpoint: string | undefined;
  tokenEndpoint: string | undefined;
  userInfoEndpoint: string | undefined;
  discoveryEndpoint: string;
  usePkce: boolean;
  allowInsecureHttp: boolean;
  timeoutMs: number;
  buttonLabel: string;
}

/**
 * Token response from the Frappe OAuth provider.
 */
export interface FrappeToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  idToken?: string;
  /** Raw token response for consumer access. */
  raw: unknown;
}

/**
 * Normalized Frappe user identity.
 */
export interface FrappeIdentity {
  /** Stable subject identifier from the provider. */
  subject: string;
  /** Normalized email (lowercase, trimmed). */
  email: string;
  /** Display name, or null if not provided. */
  name: string | null;
  /** Username, or null if not provided. */
  username: string | null;
  /** Avatar/profile image URL, or null. */
  image: string | null;
  /** Provider roles/claims array (informational only — consumer controls authorization). */
  roles: string[];
  /** Raw profile from the provider for consumer access. */
  raw: unknown;
}
