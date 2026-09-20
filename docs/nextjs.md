# Next.js + Auth.js v5

The simplest integration. Next.js has a server, so there is **no separate backend** — API routes handle the OAuth exchange automatically via Auth.js.

## 1. Install

```bash
npm install sso-frappe next-auth
```

## 2. Environment variables

```env
FRAPPE_SSO_BASE_URL=https://erp.example.com
FRAPPE_SSO_CLIENT_ID=<your-oauth-client-id>
FRAPPE_SSO_CLIENT_SECRET=<your-oauth-client-secret>
NEXTAUTH_URL=https://app.example.com
FRAPPE_SSO_BUTTON_LABEL=Login with Frappe
NEXT_PUBLIC_FRAPPE_SSO_BUTTON_LABEL=Login with Frappe
```

> `NEXT_PUBLIC_FRAPPE_SSO_BUTTON_LABEL` is inlined at **build time**. If the label differs per environment, hardcode it in the button component instead (see [Build-time env pitfall](#build-time-env-pitfall)).

## 3. Auth.js config

```ts
// auth.ts
import NextAuth from 'next-auth';
import { frappeNextAuthProvider } from 'sso-frappe/next-auth';
import type { Provider } from 'next-auth/providers';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
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

Route handler:

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

## 4. Login button

```tsx
// components/LoginButton.tsx
'use client';

import { signIn } from 'next-auth/react';

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn('frappe', { callbackUrl: '/' })}
      className="flex items-center gap-2 rounded-lg bg-[#0F2B46] px-4 py-2 text-white"
    >
      <FrappeLogo className="h-5 w-5" />
      {process.env.NEXT_PUBLIC_FRAPPE_SSO_BUTTON_LABEL ?? 'Login with Frappe'}
    </button>
  );
}
```

## 5. Protecting pages / reading session

```tsx
// middleware.ts — protect routes (Edge runtime: keep DB calls OUT of this file)
export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

```tsx
// app/dashboard/page.tsx (server component)
import { auth } from '@/auth';

export default async function Dashboard() {
  const session = await auth();
  const { frappeUsername, frappeRoles } = session?.user as unknown as {
    frappeUsername?: string;
    frappeRoles?: string[];
  };

  return (
    <div>
      <h1>Welcome, {session?.user?.name}</h1>
      <p>Frappe username: {frappeUsername}</p>
      <p>Roles: {frappeRoles?.join(', ')}</p>
    </div>
  );
}
```

## 6. Auto-create users on first login

Use the `signIn` callback (not `jwt`, not `session`) to upsert your local user. The `jwt` callback only copies claims; DB writes belong here.

```ts
// auth.ts
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async signIn({ user, account }) {
  if (account?.provider !== 'frappe') return true;
  const email = user.email;
  if (!email) return false;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.status !== 'AKTIF') return false;
    return true;
  }

  // Password: generate random bcrypt hash so the NOT NULL column is satisfied
  // but the account can never be logged into with a real password.
  const randomHash = await bcrypt.hash(
    crypto.randomUUID() + crypto.randomUUID(),
    10,
  );

  await prisma.user.create({
    data: {
      email,
      name: user.name,
      passwordHash: randomHash,
      role: process.env.FRAPPE_SSO_DEFAULT_ROLE ?? 'user',
      status: 'AKTIF',
    },
  });
  return true;
}
```

> See [database schema](database-schema.md) for the recommended `user_identities` schema — the example above uses a simple `users` table for brevity.

## Edge Runtime warning

`signIn()` / `jwt()` / `session()` callbacks run in the **Edge Runtime** (middleware). Prisma and other Node-only DB drivers crash there. Keep callbacks DB-free; do DB lookups in normal Node API routes and let the client fetch from them.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `/signin?error=Configuration` | Provider missing both `issuer` and `authorization` — use `type: 'oauth'`, not `'oidc'` (see provider-setup quirks) |
| `"issuer" property does not match` | Frappe discovery returns `http://` for https access — avoid discovery, explicit endpoints (the adapter already does this) |
| Token exchange fails: `WWW-Authenticate challenge` | Frappe needs `client_secret_post`, not Basic auth — adapter already sets it |
| `id_token` JWT validation failure | Frappe signs HS256, oauth4webapi expects RS256 — adapter strips `id_token` and uses userinfo instead |
| Login loops back to `/signin` | NextAuth callbacks doing DB work (Prisma) in Edge runtime — keep callbacks DB-free |

## Build-time env pitfall

`NEXT_PUBLIC_*` vars are inlined at build time. In Docker production builds the var is often unset → button shows the fallback label. Simplest fix: hardcode the label in the button.

The provider adapter is also **lazy**: if `baseUrl`/`clientId`/`redirectUri` are missing (env not set during `next build`), it returns `null` instead of throwing — filter it out:

```ts
providers: [
  // creds etc
  frappeNextAuthProvider({ ... }) as unknown as Provider,
].filter(Boolean),
```