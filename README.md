# sso-frappe

Reusable OAuth2/OIDC client for adding **"Login with Frappe"** to JavaScript/TypeScript applications.

One package, multiple entry points. Pick the entry point that matches your runtime. OAuth core stays shared and framework-agnostic.

---

## Supported stacks

| Stack | Entry point | Needs your own backend? |
|-------|------------|------------------------|
| **Next.js (App Router + Auth.js v5)** | `sso-frappe/next-auth` | No — Next.js server handles it |
| **Next.js (custom, no Auth.js)** | `sso-frappe/server` | No — API routes handle it |
| **Nuxt 3+** | `sso-frappe/browser` + `sso-frappe/server` | Nitro server route |
| **React SPA (Vite/CRA/Next client)** | `sso-frappe/browser` | Yes — Express/NestJS/Fastify etc. |
| **Vue / client-only SPA** | `sso-frappe/browser` | Yes — any JS backend |
| **Svelte / SvelteKit** | `sso-frappe/browser` + `sso-frappe/server` | SvelteKit server or your own |
| **Express / Fastify / Koa / Hono / NestJS** | `sso-frappe/server` | It is the backend |
| **Deno / Bun** | `sso-frappe/server` | It is the backend |
| **Laravel / Lumen / PHP** | `sso-frappe/laravel` (Composer package — see [docs/laravel.md](docs/laravel.md)) | Laravel/Lumen side |
| **Frappe → Frappe** | No package needed — use Frappe built-in Social Login Key ([docs/frappe-to-frappe.md](docs/frappe-to-frappe.md)) | None |

---

## Entry points

| Import | Purpose |
|--------|---------|
| `sso-frappe/server` | Server-side client. Token exchange with `clientSecret`, userinfo fetch, discovery. For Node.js backends. |
| `sso-frappe/browser` | Browser-safe client. Starts OAuth flow (state + PKCE + redirect) and validates callback. **Never accepts `clientSecret`.** |
| `sso-frappe/next-auth` | Auth.js v5 provider config for Next.js. |
| `sso-frappe` (root) | Shared types, config validator, error classes, `validateState`. |

---

## Quick start

### A. Next.js + Auth.js v5

```bash
npm install sso-frappe
```

```ts
// auth.ts
import NextAuth from 'next-auth';
import { frappeNextAuthProvider } from 'sso-frappe/next-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    frappeNextAuthProvider({
      baseUrl: process.env.FRAPPE_SSO_BASE_URL!,
      clientId: process.env.FRAPPE_SSO_CLIENT_ID!,
      clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/frappe`,
    }),
  ],
});
```

Full guide: **[docs/nextjs.md](docs/nextjs.md)**

### B. React SPA + JS backend

```bash
npm install sso-frappe
```

```ts
// frontend
import { createFrappeSSOBrowser } from 'sso-frappe/browser';

const sso = createFrappeSSOBrowser({
  baseUrl: process.env.NEXT_PUBLIC_FRAPPE_SSO_BASE_URL!,
  clientId: process.env.NEXT_PUBLIC_FRAPPE_SSO_CLIENT_ID!,
  redirectUri: 'https://app.example.com/auth/callback',
});

await sso.startLogin();

const { code, codeVerifier } = await sso.handleCallback();
await fetch('/api/auth/frappe/callback', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, codeVerifier }),
});
```

```ts
// backend
import { createFrappeSSO } from 'sso-frappe/server';

const sso = createFrappeSSO({
  baseUrl: process.env.FRAPPE_SSO_BASE_URL!,
  clientId: process.env.FRAPPE_SSO_CLIENT_ID!,
  clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
  redirectUri: 'https://app.example.com/auth/callback',
});

app.post('/api/auth/frappe/callback', async (req, res) => {
  const { code, codeVerifier } = req.body;
  const token = await sso.exchangeCode({ code, codeVerifier });
  const profile = await sso.getUserProfile(token);
  // upsert user, create session, respond
});
```

Full guides: **[docs/react.md](docs/react.md)**, **[docs/vue.md](docs/vue.md)**, **[docs/nuxt.md](docs/nuxt.md)**

### C. Laravel / Lumen

Package PHP terpisah: `sso-frappe/laravel`.

#### Laravel

```bash
composer require sso-frappe/laravel laravel/socialite
```

```php
use Laravel\Socialite\Facades\Socialite;

Route::get('/auth/frappe', fn () => Socialite::driver('frappe')->redirect());

Route::get('/auth/frappe/callback', function () {
    $frappeUser = Socialite::driver('frappe')->user();
    // match/create local user
});
```

#### Lumen

```bash
composer require sso-frappe/laravel
```

```php
use SsoFrappe\Laravel\FrappeClient;

$client = app(FrappeClient::class);
$url = $client->authorizationUrl($state, $codeChallenge);
$token = $client->exchangeCode($code, $codeVerifier);
$profile = $client->getUserByToken($token['access_token']);
$user = $client->mapUser($profile);
```

Full guide: **[docs/laravel.md](docs/laravel.md)**

### D. Frappe → Frappe

Frappe already has built-in Social Login Key support. Zero code on consumer side.

Full guide: **[docs/frappe-to-frappe.md](docs/frappe-to-frappe.md)**

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FRAPPE_SSO_BASE_URL` | Yes | Frappe instance URL, e.g. `https://erp.example.com` |
| `FRAPPE_SSO_CLIENT_ID` | Yes | OAuth Client ID |
| `FRAPPE_SSO_CLIENT_SECRET` | Server-only | OAuth Client Secret — **never** in browser bundles |
| `FRAPPE_SSO_REDIRECT_URI` | Yes (server) | Callback URL, must match Frappe exactly |
| `FRAPPE_SSO_BUTTON_LABEL` | No | Login button label. Default `Login with Frappe` |
| `FRAPPE_SSO_ALLOW_INSECURE_HTTP` | No | `true` for local HTTP dev. Default `false` |

---

## Configuration reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `baseUrl` | Yes | — | Frappe instance URL |
| `clientId` | Yes | — | OAuth client ID |
| `clientSecret` | Server-only | — | OAuth client secret |
| `redirectUri` | Yes | — | Consumer callback URL |
| `scope` | No | `['openid']` | OAuth scopes |
| `buttonLabel` | No | `'Login with Frappe'` | UI label |
| `usePkce` | No | `true` | PKCE S256 |
| `allowInsecureHttp` | No | `false` | Allow `http://` for local dev |
| `timeoutMs` | No | `10000` | HTTP timeout |
| `authorizationEndpoint` | No | discovery | Explicit override |
| `tokenEndpoint` | No | discovery | Explicit override |
| `userInfoEndpoint` | No | discovery | Explicit override |
| `discoveryEndpoint` | No | `${baseUrl}/.well-known/openid-configuration` | Explicit override |

---

## Security rules

- `clientSecret` lives **only** in backend. Never in browser bundles.
- `redirectUri` must **exactly match** Frappe registration.
- State must be validated on callback.
- PKCE uses `S256`.

---

## Recommended user identity schema

Add `user_identities` to link external providers to `users`. One user can log in via Frappe, Google, password, and other providers without altering schema.

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(255),
    password        VARCHAR(255),
    image           TEXT,
    status          VARCHAR(20) DEFAULT 'AKTIF',
    role            VARCHAR(50) DEFAULT 'user',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_identities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(50) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email   VARCHAR(255),
    metadata         JSONB,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (provider, provider_subject)
);
```

Full guide: **[docs/database-schema.md](docs/database-schema.md)**

---

## Docs index

| Doc | Contents |
|-----|----------|
| [docs/provider-setup.md](docs/provider-setup.md) | Create an OAuth client in Frappe |
| [docs/endpoints.md](docs/endpoints.md) | Frappe OAuth2/OIDC endpoint reference |
| [docs/nextjs.md](docs/nextjs.md) | Next.js + Auth.js v5 setup |
| [docs/react.md](docs/react.md) | React SPA + backend proxy setup |
| [docs/vue.md](docs/vue.md) | Vue SPA setup |
| [docs/nuxt.md](docs/nuxt.md) | Nuxt 3+ |
| [docs/laravel.md](docs/laravel.md) | Laravel + Lumen |
| [docs/frappe-to-frappe.md](docs/frappe-to-frappe.md) | Frappe as provider and consumer |
| [docs/database-schema.md](docs/database-schema.md) | Recommended schema |

---

## License

MIT
