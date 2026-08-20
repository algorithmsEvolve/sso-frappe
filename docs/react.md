# React SPA + backend proxy

Use `sso-frappe/browser` in the React app and `sso-frappe/server` in your backend (Express, NestJS, Hono, Fastify, ...).

> React **does not** talk to Frappe's token endpoint directly. The backend keeps `clientSecret` server-side.

## Architecture

```
React button/page
   │  startLogin()
   ▼
Frappe authorize page
   │  redirect back with code + state
   ▼
React callback page
   │  POST { code, codeVerifier }
   ▼
Your backend
   │  exchangeCode() + getUserProfile()
   ▼
Create local session/cookie/JWT
```

## Frontend env vars

```env
VITE_FRAPPE_SSO_BASE_URL=https://erp.example.com
VITE_FRAPPE_SSO_CLIENT_ID=<oauth-client-id>
VITE_FRAPPE_SSO_REDIRECT_URI=http://localhost:5173/auth/callback
```

> `clientSecret` is intentionally **absent** here.

## 1. Login button

```tsx
// src/components/LoginWithFrappeButton.tsx
import { createFrappeSSOBrowser } from 'sso-frappe/browser';

const sso = createFrappeSSOBrowser({
  baseUrl: import.meta.env.VITE_FRAPPE_SSO_BASE_URL,
  clientId: import.meta.env.VITE_FRAPPE_SSO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_FRAPPE_SSO_REDIRECT_URI,
  allowInsecureHttp: true, // local dev only
});

export function LoginWithFrappeButton() {
  return (
    <button
      onClick={() => sso.startLogin()}
      className="rounded-lg bg-slate-900 px-4 py-2 text-white"
    >
      Login with Frappe
    </button>
  );
}
```

## 2. Callback page

```tsx
// src/pages/FrappeCallbackPage.tsx
import { useEffect, useState } from 'react';
import { createFrappeSSOBrowser } from 'sso-frappe/browser';
import { useNavigate } from 'react-router-dom';

const sso = createFrappeSSOBrowser({
  baseUrl: import.meta.env.VITE_FRAPPE_SSO_BASE_URL,
  clientId: import.meta.env.VITE_FRAPPE_SSO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_FRAPPE_SSO_REDIRECT_URI,
  allowInsecureHttp: true,
});

export default function FrappeCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { code, codeVerifier } = await sso.handleCallback();

        const response = await fetch('/api/auth/frappe/callback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, codeVerifier }),
        });

        if (!response.ok) {
          throw new Error('SSO callback failed');
        }

        sso.clear();
        navigate('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown SSO error');
      }
    })();
  }, [navigate]);

  if (error) {
    return <p>Login failed: {error}</p>;
  }

  return <p>Finishing login...</p>;
}
```

## 3. Express backend

```ts
import express from 'express';
import session from 'express-session';
import { createFrappeSSO } from 'sso-frappe/server';

const app = express();
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // local dev only
    },
  }),
);

const sso = createFrappeSSO({
  baseUrl: process.env.FRAPPE_SSO_BASE_URL!,
  clientId: process.env.FRAPPE_SSO_CLIENT_ID!,
  clientSecret: process.env.FRAPPE_SSO_CLIENT_SECRET!,
  redirectUri: process.env.FRAPPE_SSO_REDIRECT_URI!,
  allowInsecureHttp: true,
});

app.post('/api/auth/frappe/callback', async (req, res) => {
  try {
    const { code, codeVerifier } = req.body as {
      code?: string;
      codeVerifier?: string;
    };

    if (!code || !codeVerifier) {
      return res.status(400).json({ message: 'Missing code or codeVerifier' });
    }

    const token = await sso.exchangeCode({ code, codeVerifier });
    const profile = await sso.getUserProfile(token);

    // Match/create local user (Pattern C schema shown in docs/database-schema.md)
    const user = await upsertUserFromFrappe(profile);

    req.session.userId = user.id;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: 'SSO callback failed' });
  }
});
```

## Pattern C: recommended user matching

1. Look up `user_identities(provider='frappe', provider_subject=profile.subject)`
2. If missing, fallback to `users.email = profile.email`
3. If email exists, insert the `frappe` identity row and link it
4. If still missing, create `users` row + `user_identities` row
5. Create the app session **after** the local user is resolved

See [database schema](database-schema.md) for the full schema.

## NestJS / Fastify / Hono / Koa

Same flow. Only route syntax changes:

- NestJS: controller method + session middleware
- Fastify: `fastify.post('/api/auth/frappe/callback', async (request, reply) => ...)`
- Hono: `app.post('/api/auth/frappe/callback', async (c) => ...)`

The `sso-frappe/server` client code is identical.

## Common mistakes

| Mistake | Why it breaks |
|---------|---------------|
| Putting `FRAPPE_SSO_CLIENT_SECRET` in `VITE_*` or `NEXT_PUBLIC_*` | Exposes the secret in the browser bundle |
| Doing `exchangeCode()` in React | Same problem — requires the secret |
| Matching users by email only | Email can change in Frappe; always prefer `provider_subject` |
| Auto-creating a password string you expect users to log in with | SSO users often should have `password = NULL`, or a random hash if the DB column is NOT NULL |

## Optional: central `/start` route

If you prefer your backend to own state + redirect (instead of the SPA calling `startLogin()`), you can expose `/api/auth/frappe/start` and let the button simply do `window.location.href = '/api/auth/frappe/start'`. That backend route generates `{ url, state, codeVerifier }`, stores the state/verifier in a server-side session, then redirects to Frappe. Both patterns are valid.
