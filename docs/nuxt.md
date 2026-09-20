# Nuxt 3+ (Nitro server + client)

Nuxt is special: it has a **Nitro server** built in. You can use `sso-frappe/server` in Nitro server routes and `sso-frappe/browser` on the client — no separate backend needed.

## Architecture

```
Nuxt client (Vue)
   │  startLogin() or link to /api/auth/frappe/start
   ▼
Frappe authorize page
   │  redirect back with code + state
   ▼
Nuxt Nitro server route
   │  exchangeCode() + getUserProfile()
   ▼
Nuxt session (cookie)
```

## Env vars

```env
NUXT_PUBLIC_FRAPPE_SSO_BASE_URL=https://erp.example.com
NUXT_PUBLIC_FRAPPE_SSO_CLIENT_ID=<oauth-client-id>
FRAPPE_SSO_CLIENT_SECRET=<secret>
FRAPPE_SSO_REDIRECT_URI=https://app.example.com/api/auth/frappe/callback
```

> `clientSecret` is **server-only** — no `NUXT_PUBLIC_` prefix.

## Option A — Backend-managed flow (recommended for Nuxt)

The Nitro server owns the entire flow. The client just links to `/api/auth/frappe/start`.

### Server route: start

```ts
// server/api/auth/frappe/start.ts
import { createFrappeSSO } from 'sso-frappe/server';

export default defineEventHandler(async (event) => {
  const sso = createFrappeSSO({
    baseUrl: process.env.NUXT_PUBLIC_FRAPPE_SSO_BASE_URL!,
    clientId: process.env.NUXT_PUBLIC_FRAPPE_SSO_CLIENT_ID!,
    clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
    redirectUri: process.env.FRAPPE_SSO_REDIRECT_URI!,
  });

  const { url, state, codeVerifier } = await sso.createAuthorizationUrl();

  // Store in cookie (httpOnly, short-lived)
  setCookie(event, 'frappe_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
  });
  setCookie(event, 'frappe_oauth_verifier', codeVerifier!, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
  });

  return sendRedirect(event, url);
});
```

### Server route: callback

```ts
// server/api/auth/frappe/callback.ts
import { createFrappeSSO, validateState } from 'sso-frappe/server';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;

  const storedState = getCookie(event, 'frappe_oauth_state') ?? '';
  const codeVerifier = getCookie(event, 'frappe_oauth_verifier') ?? '';

  validateState(storedState, state);

  const sso = createFrappeSSO({
    baseUrl: process.env.NUXT_PUBLIC_FRAPPE_SSO_BASE_URL!,
    clientId: process.env.NUXT_PUBLIC_FRAPPE_SSO_CLIENT_ID!,
    clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
    redirectUri: process.env.FRAPPE_SSO_REDIRECT_URI!,
  });

  const token = await sso.exchangeCode({ code, codeVerifier });
  const profile = await sso.getUserProfile(token);

  // Match/create user (see docs/database-schema.md)
  const user = await upsertUserFromFrappe(profile);

  // Set app session
  setCookie(event, 'session', createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
  });

  // Clean up OAuth cookies
  deleteCookie(event, 'frappe_oauth_state');
  deleteCookie(event, 'frappe_oauth_verifier');

  return sendRedirect(event, '/dashboard');
});
```

### Client: login button

```vue
<!-- components/FrappeLoginButton.vue -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string;
}>(), {
  label: 'Login with Frappe',
});
</script>

<template>
  <NuxtLink
    to="/api/auth/frappe/start"
    class="rounded-lg bg-slate-900 px-4 py-2 text-white"
  >
    {{ label }}
  </NuxtLink>
</template>
```

```vue
<!-- app.vue or pages/login.vue -->
<template>
  <FrappeLoginButton label="Masuk dengan Frappe" />
</template>
```

### Client: reading session

```ts
// composables/useAuth.ts
export function useAuth() {
  const session = useState<SessionData | null>('session', () => null);

  async function fetchSession() {
    const res = await $fetch('/api/auth/session');
    session.value = res as SessionData;
  }

  return { session, fetchSession };
}
```

```ts
// server/api/auth/session.ts
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'session');
  if (!token) return null;
  return verifySessionToken(token);
});
```

### Route middleware (auth guard)

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async () => {
  const { session, fetchSession } = useAuth();
  if (!session.value) await fetchSession();
  if (!session.value) return navigateTo('/login');
});
```

## Option B — Browser-managed PKCE

Use `sso-frappe/browser` on the client (same as the [Vue SPA guide](vue.md)). The Nitro server only handles the POST callback:

```ts
// server/api/auth/frappe/callback.post.ts
import { createFrappeSSO } from 'sso-frappe/server';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { code, codeVerifier } = body;

  const sso = createFrappeSSO({ /* ... */ });
  const token = await sso.exchangeCode({ code, codeVerifier });
  const profile = await sso.getUserProfile(token);

  // ... upsert user, set session cookie
  return { ok: true };
});
```

Client side uses `createFrappeSSOBrowser` — see the [Vue SPA guide](vue.md) for the composable and callback page.

## Which option to pick?

| | Option A (backend-managed) | Option B (browser PKCE) |
|--|---------------------------|------------------------|
| State storage | Server cookie (httpOnly) | `sessionStorage` |
| Client complexity | Just a link | Import + composable |
| Best for | Production, SSR | Pure SPA mode, static hosting |

**Recommendation:** Option A for most Nuxt apps. The server is already there — use it.
