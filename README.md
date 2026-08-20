# sso-frappe

Reusable OAuth2/OIDC client for adding **"Login with Frappe"** to any JavaScript/TypeScript application.

One package, multiple entry points — each entry point targets a specific environment (browser vs server vs framework adapter). Pick the ones you need; the OAuth core is shared and framework-agnostic.

---

## Supported Stacks

| Stack | Entry point | Needs your own backend? |
|-------|------------|------------------------|
| **Next.js (App Router + Auth.js v5)** | `sso-frappe/next-auth` | No — Next.js server handles it |
| **Next.js (custom, no Auth.js)** | `sso-frappe/server` | No — API routes handle it |
| **Nuxt 3+** | `sso-frappe/browser` + `sso-frappe/server` | Nitro server route (docs show exact setup) |
| **React SPA (Vite/CRA/Next client)** | `sso-frappe/browser` | Yes — Express/NestJS/Fastify etc. |
| **Vue / Nuxt SPA (client-only)** | `sso-frappe/browser` | Yes — any JS backend |
| **Svelte / SvelteKit** | `sso-frappe/browser` + `sso-frappe/server` | SvelteKit server or your own |
| **Express / Fastify / Koa / Hono / NestJS** | `sso-frappe/server` | It is the backend |
| **Deno / Bun** | `sso-frappe/server` | It is the backend |
| **Laravel / PHP** | `sso-frappe-laravel` (separate Composer package — see [docs/laravel.md](docs/laravel.md)) | Laravel side |
| **Frappe → Frappe** | No package needed — use Frappe's built-in Social Login Key ([docs/frappe-to-frappe.md](docs/frappe-to-frappe.md)) | None |

> **Go / Python / Ruby**: out of scope for now. If you need one, the JS package is the reference implementation.

---

## Install

```bash
npm install sso-frappe
```

---

## Entry points

| Import | Purpose |
|--------|---------|
| `sso-frappe/server` | Server-side client. Token exchange with `clientSecret`, userinfo fetch, discovery. For Node.js backends (Express, NestJS, Nitro, ...). |
| `sso-frappe/browser` | Browser-safe client. Starts the OAuth flow (state + PKCE + redirect) and validates the callback. **Never accepts `clientSecret`.** For SPAs (React, Vue, Svelte, vanilla JS). |
| `sso-frappe/next-auth` | Auth.js v5 provider config for Next.js. |
| `sso-frappe` (root) | Shared types, config validator, error classes, `validateState`. |

---

## Quick Start

### A. Next.js + Auth.js v5 (the classic setup)

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

### B. React SPA + any JS backend

```ts
// frontend — login button + callback handling
import { createFrappeSSOBrowser } from 'sso-frappe/browser';

const sso = createFrappeSSOBrowser({
  baseUrl: process.env.NEXT_PUBLIC_FRAPPE_SSO_BASE_URL!,
  clientId: process.env.NEXT_PUBLIC_FRAPPE_SSO_CLIENT_ID!,
  redirectUri: 'https://app.example.com/auth/callback',
});

// on login button click:
await sso.startLogin(); // redirects to Frappe

// on callback page:
const { code, codeVerifier } = await sso.handleCallback();
await fetch('/api/auth/frappe/callback', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, codeVerifier }),
});
```

```ts
// backend — Express (or NestJS/Fastify/Hono)
import { createFrappeSSO, validateState } from 'sso-frappe/server';

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
  // ... upsert user, create session, respond
});
```

Full guides: **[docs/react.md](docs/react.md)**, **[docs/vue.md](docs/vue.md)**, **[docs/nuxt.md](docs/nuxt.md)**

### C. Laravel

Laravel is a **separate Composer package** (`sso-frappe-laravel`, built on Laravel Socialite) — PHP cannot `require` an npm package. The JS package remains the single source of truth for the Frappe OAuth quirks.

```bash
composer require sso-frappe/laravel
```

```php
// config/services.php
'frappe' => [
    'base_url' => env('FRAPPE_SSO_BASE_URL'),
    'client_id' => env('FRAPPE_SSO_CLIENT_ID'),
    'client_secret' => env('FRAPPE_SSO_CLIENT_SECRET'),
    'redirect' => env('FRAPPE_SSO_REDIRECT_URI'),
],
```

Full plan + guide: **[docs/laravel.md](docs/laravel.md)**

### D. Frappe → Frappe (no code)

Frappe has a built-in "Social Login Key" — configure it in the UI, zero code.

Full guide: **[docs/frappe-to-frappe.md](docs/frappe-to-frappe.md)**

---

## Environment variables (convention — same across all stacks)

| Variable | Required | Description |
|----------|----------|-------------|
| `FRAPPE_SSO_BASE_URL` | Yes | Frappe instance URL, e.g. `https://erp.example.com` |
| `FRAPPE_SSO_CLIENT_ID` | Yes | OAuth Client ID (from Frappe OAuth2 Settings) |
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
| `clientSecret` | Server-only | — | OAuth client secret (confidential clients) |
| `redirectUri` | Yes | — | Consumer callback URL |
| `scope` | No | `['openid']` | OAuth scopes |
| `buttonLabel` | No | `'Login with Frappe'` | UI label for login button |
| `usePkce` | No | `true` | PKCE S256 |
| `allowInsecureHttp` | No | `false` | Allow `http://` for local dev |
| `timeoutMs` | No | `10000` | HTTP timeout |
| `authorizationEndpoint` | No | discovery | Explicit override |
| `tokenEndpoint` | No | discovery | Explicit override |
| `userInfoEndpoint` | No | discovery | Explicit override |
| `discoveryEndpoint` | No | `${baseUrl}/.well-known/openid-configuration` | Explicit override |

---

## How the flow works

```
Browser (SPA)                          Your backend                    Frappe
─────────────                          ────────────                    ──────
1. startLogin()                        
   state + PKCE → sessionStorage       
2. redirect → ───────────────────────────────────────────────► authorize page
3. user logs in + approves                                    
4. ←──── code + state ── redirect ── bargain callback ─────────
5. handleCallback()                    
   validate state                      
6. POST {code, codeVerifier} ──► 7. exchangeCode(code, verifier)  
                                 8. getUserProfile(token)  ──► userinfo
                                 9. upsert user (your schema)    
                                 10. create session (cookie/JWT)  
11. ←── session ──                                                 
```

**Security rules:**

- `clientSecret` lives **only** in your backend (Express, NestJS, Nitro, Next.js API route, ...). Never in browser bundles.
- `redirectUri` must **exactly match** the one registered in Frappe (protocol + host + path).
- State must be validated on callback (CSRF). `sso-frappe/browser` and `/server` do this for you.
- PKCE is always on, with `S256`.

---

## Database schema recommendation (Pattern C)

Add a `user_identities` table to link external providers to your `users` table — one user can log in via Frappe **and** Google **and** password. Adding a new provider = inserting a row, not altering a table.

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(255),
    password        VARCHAR(255),               -- NULL = SSO-only user
    image           TEXT,
    status          VARCHAR(20) DEFAULT 'AKTIF',
    role            VARCHAR(50) DEFAULT 'user',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_identities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(50) NOT NULL,      -- 'frappe', 'google', ...
    provider_subject VARCHAR(255) NOT NULL,     -- stable ID (sub claim)
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
| [docs/nuxt.md](docs/nuxt.md) | Nuxt 3+ (Nitro server + client) |
| [docs/laravel.md](docs/laravel.md) | Laravel plan + Socialite-based package |
| [docs/frappe-to-frappe.md](docs/frappe-to-frappe.md) | Frappe as both provider & consumer (Social Login Key) |
| [docs/database-schema.md](docs/database-schema.md) | Recommended `users` + `user_identities` schema (Pattern C) |
| [docs/browser-client.md](docs/browser-client.md) | `sso-frappe/browser` API reference |

---

## Development

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

---

## License

MIT