import type { NormalizedFrappeSSOConfig, FrappeToken, FrappeIdentity } from './types';
import { defineFrappeSSOConfig } from './config';
import { resolveProviderEndpoints } from './providers/frappe';
import { createState } from './oauth/state';
import { createPkcePair } from './oauth/pkce';
import { buildAuthorizationUrl } from './oauth/authorization';
import { exchangeCode } from './oauth/token';
import { fetchUserInfo } from './oauth/userinfo';
import { normalizeProfile } from './profile';

export interface CreateAuthorizationUrlOptions {
  /** Unique key for this request (e.g. session ID or random nonce). Consumer stores state+verifier against this. */
  stateStoreKey?: string;
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string | null;
}

export interface FrappeSSOClient {
  /** Generate the authorization URL + state/PKCE material for the consumer to store. */
  createAuthorizationUrl(options?: CreateAuthorizationUrlOptions): Promise<AuthorizationRequest>;
  /** Exchange an authorization code for a token. */
  exchangeCode(input: { code: string; codeVerifier?: string }): Promise<FrappeToken>;
  /** Fetch and normalize the user profile using an access token. */
  getUserProfile(token: FrappeToken): Promise<FrappeIdentity>;
}

/**
 * Create a Frappe SSO client.
 *
 * The client lazily resolves provider endpoints on first use and caches them.
 * Importing this module does not perform any network I/O.
 */
export function createFrappeSSO(
  configInput: Parameters<typeof defineFrappeSSOConfig>[0],
): FrappeSSOClient {
  const config: NormalizedFrappeSSOConfig = defineFrappeSSOConfig(configInput);

  // Lazily-resolved endpoint cache
  let endpointsCache: Awaited<ReturnType<typeof resolveProviderEndpoints>> | null = null;

  async function getEndpoints() {
    if (endpointsCache) return endpointsCache;
    endpointsCache = await resolveProviderEndpoints({
      baseUrl: config.baseUrl,
      authorizationEndpoint: config.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      userInfoEndpoint: config.userInfoEndpoint,
      discoveryEndpoint: config.discoveryEndpoint,
      timeoutMs: config.timeoutMs,
    });
    return endpointsCache;
  }

  return {
    async createAuthorizationUrl(options?: CreateAuthorizationUrlOptions) {
      const endpoints = await getEndpoints();

      const state = createState();
      let codeVerifier: string | null = null;
      let codeChallenge: string | undefined;

      if (config.usePkce) {
        const pkce = await createPkcePair();
        codeVerifier = pkce.codeVerifier;
        codeChallenge = pkce.codeChallenge;
      }

      const { url } = buildAuthorizationUrl({
        authorizationEndpoint: endpoints.authorizationEndpoint,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: config.scope,
        state,
        usePkce: config.usePkce,
        codeChallenge,
      });

      // stateStoreKey is accepted for future use but the consumer is responsible
      // for associating state+codeVerifier with their own session/request.
      void options?.stateStoreKey;

      return { url, state, codeVerifier };
    },

    async exchangeCode({ code, codeVerifier }) {
      const endpoints = await getEndpoints();

      return exchangeCode({
        tokenEndpoint: endpoints.tokenEndpoint,
        clientId: config.clientId,
        clientSecret: config.clientSecret ?? '',
        redirectUri: config.redirectUri,
        code,
        codeVerifier: codeVerifier ?? undefined,
        timeoutMs: config.timeoutMs,
      });
    },

    async getUserProfile(token: FrappeToken) {
      const endpoints = await getEndpoints();

      const userInfoEndpoint = endpoints.userInfoEndpoint;
      if (!userInfoEndpoint) {
        // Fall back to discovery path if userinfo endpoint not resolved
        throw new Error(
          'Userinfo endpoint not available. Ensure discovery is enabled or provide userInfoEndpoint explicitly.',
        );
      }

      const raw = await fetchUserInfo({
        userInfoEndpoint,
        accessToken: token.accessToken,
        timeoutMs: config.timeoutMs,
      });

      return normalizeProfile(raw);
    },
  };
}

export { defineFrappeSSOConfig } from './config';
export { frappeProvider } from './providers/frappe';
