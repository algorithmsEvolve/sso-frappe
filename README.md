# sso-frappe

Reusable OAuth2/OIDC client for adding **"Login with Frappe"** to any Next.js or Node.js project.

## Install

```bash
npm install sso-frappe
```

## Quick Start (Next.js + Auth.js v5)

### 1. Set environment variables

```env
FRAPPE_SSO_BASE_URL=https://your-frappe.example.com
FRAPPE_SSO_CLIENT_ID=your-oauth-client-id
FRAPPE_SSO_CLIENT_SECRET=your-oauth-client-secret
FRAPPE_SSO_BUTTON_LABEL=Login with Frappe
NEXT_PUBLIC_FRAPPE_SSO_BUTTON_LABEL=Login with Frappe
```

### 2. Add the provider to your NextAuth config

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { frappeNextAuthProvider } from 'sso-frappe/next-auth';
import type { Provider } from 'next-auth/providers';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // your existing providers...
    frappeNextAuthProvider({
      baseUrl: process.env.FRAPPE_SSO_BASE_URL!,
      clientId: process.env.FRAPPE_SSO_CLIENT_ID!,
      clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/frappe`,
      buttonLabel: process.env.FRAPPE_SSO_BUTTON_LABEL ?? 'Login with Frappe',
    }) as unknown as Provider,
  ],
  // ...callbacks, session, etc.
});
```

### 3. Add a login button

```tsx
import { signIn } from 'next-auth/react';

<button onClick={() => signIn('frappe', { callbackUrl: '/' })}>
  {process.env.NEXT_PUBLIC_FRAPPE_SSO_BUTTON_LABEL ?? 'Login with Frappe'}
</button>
```

### 4. Configure your Frappe instance

See [docs/provider-setup.md](docs/provider-setup.md) for instructions on creating an OAuth client in Frappe.

## API

### `frappeNextAuthProvider(config)`

Returns an Auth.js v5 provider config for Frappe SSO. Spread into your `providers` array.

### `createFrappeSSO(config)`

Returns a standalone SSO client (no NextAuth dependency):

```ts
import { createFrappeSSO } from 'sso-frappe/server';

const sso = createFrappeSSO({
  baseUrl: 'https://your-frappe.example.com',
  clientId: '...',
  clientSecret: '...',
  redirectUri: 'https://app.example.com/callback',
});

// Generate authorization URL + state + PKCE
const { url, state, codeVerifier } = await sso.createAuthorizationUrl();

// Exchange code for token
const token = await sso.exchangeCode({ code, codeVerifier });

// Fetch normalized user profile
const profile = await sso.getUserProfile(token);
```

### `defineFrappeSSOConfig(config)`

Validates and normalizes configuration. Throws `FrappeSSOConfigError` on invalid input.

## Configuration

| Field | Env var | Required | Default | Description |
|-------|---------|----------|---------|-------------|
| `baseUrl` | `FRAPPE_SSO_BASE_URL` | Yes | — | Frappe instance URL |
| `clientId` | `FRAPPE_SSO_CLIENT_ID` | Yes | — | OAuth client ID |
| `clientSecret` | `FRAPPE_SSO_CLIENT_SECRET` | No | — | OAuth client secret (confidential clients) |
| `redirectUri` | — | Yes | — | Consumer callback URL |
| `scope` | — | No | `['openid']` | OAuth scopes |
| `buttonLabel` | `FRAPPE_SSO_BUTTON_LABEL` | No | `'Login with Frappe'` | UI label for login button |
| `usePkce` | — | No | `true` | Enable PKCE (S256) |
| `allowInsecureHttp` | — | No | `false` | Allow HTTP (non-HTTPS) baseUrl |
| `timeoutMs` | — | No | `10000` | HTTP timeout in ms |

## License

MIT
