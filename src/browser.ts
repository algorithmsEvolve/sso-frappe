import { defineFrappeSSOConfig } from './config';
import type { NormalizedFrappeSSOConfig } from './types';
import { createState, validateState } from './oauth/state';
import { createPkcePair } from './oauth/pkce';
import { buildAuthorizationUrl } from './oauth/authorization';
import { FrappeSSOStateError } from './errors';

/** Storage keys used by the browser client. */
export const BROWSER_STORAGE_KEYS = {
  state: 'frappe_sso_state',
  codeVerifier: 'frappe_sso_code_verifier',
} as const;

/**
 * Configuration for the browser (SPA) client.
 *
 * Unlike the server client, this never accepts a `clientSecret` and never
 * performs token exchange. Token exchange must be delegated to your own
 * backend (which keeps the secret server-side).
 */
export interface FrappeSSOBrowserConfig {
  /** Base URL of the Frappe website, e.g. `https://erp.example.com`. */
  baseUrl: string;
  /** OAuth Client ID created in the Frappe provider. Public — safe in the browser. */
  clientId: string;
  /** Consumer callback URL, e.g. `https://app.example.com/auth/callback`. */
  redirectUri: string;
  /** OAuth scopes to request. Defaults to `['openid']`. */
  scope?: readonly string[];
  /**
   * Explicit authorization endpoint override.
   * Defaults to `${baseUrl}/api/method/frappe.integrations.oauth2.authorize`.
   */
  authorizationEndpoint?: string;
  /**
   * Web Storage to use. Defaults to `window.sessionStorage`.
   * Injectable for testing and for storage-restricted environments.
   */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Allow non-HTTPS URLs for local development. Defaults to `false`. */
  allowInsecureHttp?: boolean;
  /** Login button label. Defaults to `Login with Frappe`. */
  buttonLabel?: string;
}

export interface BrowserLoginResult {
  /** The generated OAuth `state` value (for reference/debugging). */
  state: string;
  /** The generated PKCE `codeVerifier` (for reference/debugging). */
  codeVerifier: string;
}

export interface BrowserCallbackResult {
  /** The authorization code received from Frappe. */
  code: string;
  /** The PKCE code verifier. POST this to your backend together with `code`. */
  codeVerifier: string;
  /** The OAuth state that was validated. */
  state: string;
}

export interface FrappeSSOBrowserClient {
  /**
   * Generate state + PKCE, persist them, and redirect the browser to Frappe.
   * Returns the generated material for callers that need it (e.g. tests).
   */
  startLogin(): Promise<BrowserLoginResult>;
  /**
   * Parse the current URL's query params, validate `state`, and return
   * `{ code, codeVerifier }` for the consumer to POST to their backend.
   * Throws `FrappeSSOStateError` on missing/unknown state or missing code.
   */
  handleCallback(
    url?: string | URL,
  ): Promise<BrowserCallbackResult>;
  /** Clear persisted OAuth material (call after successful exchange). */
  clear(): void;
}

/**
 * Create a browser-safe Frappe SSO client for SPAs (React, Vue, Svelte, ...).
 *
 * Handles the browser side of the OAuth flow only:
 * generate state + PKCE, redirect to Frappe, validate state on callback.
 *
 * Token exchange (`exchangeCode`) and profile fetching must happen on YOUR
 * backend using `sso-frappe/server` — the browser client has no
 * `clientSecret` and never sends one.
 */
export function createFrappeSSOBrowser(
  configInput: FrappeSSOBrowserConfig,
): FrappeSSOBrowserClient {
  const storage = configInput.storage ?? getDefaultStorage();

  const normalized: NormalizedFrappeSSOConfig = defineFrappeSSOConfig({
    baseUrl: configInput.baseUrl,
    clientId: configInput.clientId,
    redirectUri: configInput.redirectUri,
    scope: configInput.scope,
    authorizationEndpoint: configInput.authorizationEndpoint,
    buttonLabel: configInput.buttonLabel,
    allowInsecureHttp: configInput.allowInsecureHttp ?? false,
  });

  const base = normalized.baseUrl.replace(/\/+$/, '');
  const authorizationEndpoint =
    normalized.authorizationEndpoint ??
    `${base}/api/method/frappe.integrations.oauth2.authorize`;

  return {
    async startLogin() {
      const state = createState();
      const pkce = await createPkcePair();

      storage.setItem(BROWSER_STORAGE_KEYS.state, state);
      storage.setItem(BROWSER_STORAGE_KEYS.codeVerifier, pkce.codeVerifier);

      const { url } = buildAuthorizationUrl({
        authorizationEndpoint,
        clientId: normalized.clientId,
        redirectUri: normalized.redirectUri,
        scope: normalized.scope,
        state,
        usePkce: true,
        codeChallenge: pkce.codeChallenge,
      });

      const g = globalThis as unknown as { window?: { location?: { assign?: (url: string) => void } } };
      if (g.window?.location?.assign) {
        g.window.location.assign(url);
      }

      return { state, codeVerifier: pkce.codeVerifier };
    },

    async handleCallback(url?: string | URL) {
      const currentUrl =
        url instanceof URL
          ? url
          : typeof url === 'string'
            ? new URL(url)
            : getCurrentUrl();

      const code = currentUrl.searchParams.get('code');
      if (!code) {
        throw new FrappeSSOStateError('Callback URL is missing the authorization code');
      }

      const receivedState = currentUrl.searchParams.get('state') ?? '';
      const storedState = storage.getItem(BROWSER_STORAGE_KEYS.state) ?? '';
      validateState(storedState, receivedState);

      const codeVerifier =
        storage.getItem(BROWSER_STORAGE_KEYS.codeVerifier) ?? '';
      if (!codeVerifier) {
        throw new FrappeSSOStateError('Code verifier not found in storage');
      }

      return { code, codeVerifier, state: receivedState };
    },

    clear() {
      storage.removeItem(BROWSER_STORAGE_KEYS.state);
      storage.removeItem(BROWSER_STORAGE_KEYS.codeVerifier);
    },
  };
}

function getDefaultStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const g = globalThis as unknown as { window?: { sessionStorage?: Storage } };
  if (!g.window?.sessionStorage) {
    throw new FrappeSSOStateError(
      'No storage available. Pass a `storage` implementation when running outside a browser.',
    );
  }
  return g.window.sessionStorage;
}

function getCurrentUrl(): URL {
  const g = globalThis as unknown as { window?: { location?: { href?: string } } };
  if (!g.window?.location?.href) {
    throw new FrappeSSOStateError(
      'No window.location available. Pass a URL to handleCallback() when running outside a browser.',
    );
  }
  return new URL(g.window.location.href);
}
