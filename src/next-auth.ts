import { defineFrappeSSOConfig } from './config';
import type { FrappeSSOConfig } from './types';

/**
 * Result of frappeNextAuthProvider — structurally compatible with
 * Auth.js v5's OAuth provider interface. Spread into your `providers` array.
 */
export interface FrappeNextAuthProviderResult {
  id: string;
  name: string;
  type: 'oauth';
  clientId: string;
  clientSecret: string | undefined;
  authorization: {
    url: string;
    params: {
      scope: string;
    };
  };
  token: {
    url: string;
    conform?: (response: Response) => Promise<Response>;
  };
  userinfo: {
    url: string;
  };
  client: {
    token_endpoint_auth_method: string;
  };
  idToken: boolean;
  profile: (profile: Record<string, unknown>) => {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    frappeUsername?: string;
    frappeRoles: string[];
  };
}

/**
 * Create an Auth.js v5 (NextAuth) provider config for Frappe SSO.
 *
 * Spread the result into your `providers` array:
 *
 * ```ts
 * import NextAuth from 'next-auth';
 * import { frappeNextAuthProvider } from 'sso-frappe/next-auth';
 *
 * export const { handlers, auth } = NextAuth({
 *   providers: [
 *     frappeNextAuthProvider({
 *       baseUrl: process.env.FRAPPE_SSO_BASE_URL!,
 *       clientId: process.env.FRAPPE_SSO_CLIENT_ID!,
 *       clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
 *       redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/frappe`,
 *       buttonLabel: 'Login with Visions',
 *     }),
 *   ],
 * });
 * ```
 *
 * NextAuth handles PKCE, state, cookies, and token exchange natively.
 * This adapter only provides the Frappe-specific config and profile normalization.
 */
export function frappeNextAuthProvider(
  config: FrappeSSOConfig,
): FrappeNextAuthProviderResult | null {
  // Skip validation if required fields are missing (e.g. during build when env is not set)
  if (!config.baseUrl || !config.clientId || !config.redirectUri) {
    return null;
  }

  const normalized = defineFrappeSSOConfig(config);

  const base = normalized.baseUrl.replace(/\/$/, '');

  return {
    id: 'frappe',
    name: normalized.buttonLabel,
    type: 'oauth',
    clientId: normalized.clientId,
    clientSecret: normalized.clientSecret,
    authorization: {
      url: `${base}/api/method/frappe.integrations.oauth2.authorize`,
      params: {
        scope: normalized.scope.join(' '),
      },
    },
    token: {
      url: `${base}/api/method/frappe.integrations.oauth2.get_token`,
      conform: async (response: Response) => {
        // Frappe returns id_token signed with HS256 which oauth4webapi rejects.
        // Strip id_token from the response so Auth.js uses userinfo endpoint instead.
        const body = await response.json();
        if (body && typeof body === 'object' && 'id_token' in body) {
          delete (body as Record<string, unknown>).id_token;
        }
        const headers = new Headers(response.headers);
        headers.set('content-type', 'application/json');
        return new Response(JSON.stringify(body), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      },
    },
    userinfo: {
      url: `${base}/api/method/frappe.integrations.oauth2.openid_profile`,
    },
    idToken: false,
    client: {
      token_endpoint_auth_method: 'client_secret_post',
    },
    profile(profile: Record<string, unknown>) {
      const email =
        typeof profile.email === 'string'
          ? profile.email.trim().toLowerCase()
          : null;

      const name =
        (typeof profile.full_name === 'string' && profile.full_name) ||
        (typeof profile.name === 'string' && profile.name) ||
        (email ? email.split('@')[0] : null);

      return {
        id:
          (typeof profile.sub === 'string' && profile.sub) ||
          (typeof profile.user_id === 'string' && profile.user_id) ||
          (typeof profile.name === 'string' && profile.name) ||
          email ||
          'unknown',
        name,
        email,
        image:
          typeof profile.user_image === 'string' ? profile.user_image : null,
        frappeUsername:
          typeof profile.username === 'string' ? profile.username : undefined,
        frappeRoles: Array.isArray(profile.roles)
          ? (profile.roles as string[])
          : [],
      };
    },
  };
}
