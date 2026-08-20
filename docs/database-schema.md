# Database schema (Pattern C — identity providers)

Recommended schema for storing SSO users. Pattern C = `users` + `user_identities` — one user can log in via Frappe, Google, GitHub, **and** password. Adding a new provider = inserting a row, not altering a table.

## Why not Pattern A or B?

| Pattern | Structure | Problem |
|---------|-----------|---------|
| A — single table | `users` + `frappe_subject`, `is_frappe`, `google_subject`, `is_google`... | Table grows a column pair per provider. Not scalable. |
| B — one table per provider | `users` + `user_frappes`, `user_googles`... | One table per provider. Not scalable. |
| **C — identity providers table** | `users` + `user_identities` | **Recommended.** New provider = new row. |

## Schema

```sql
-- Core user identity
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    name        VARCHAR(255),
    password    VARCHAR(255),          -- NULL = SSO-only user (no password login)
    image       TEXT,                  -- avatar from provider
    status      VARCHAR(20) DEFAULT 'AKTIF',   -- AKTIF / NONAKTIF
    role        VARCHAR(50) DEFAULT 'user',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- External identity links (Frappe, Google, GitHub, ...)
CREATE TABLE user_identities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(50) NOT NULL,        -- 'frappe', 'google', 'github'
    provider_subject VARCHAR(255) NOT NULL,        -- stable ID (sub / user_id claim)
    provider_email   VARCHAR(255),                 -- email at login time (can differ from users.email)
    metadata         JSONB,                        -- roles, raw profile
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),

    UNIQUE (provider, provider_subject)
);
```

## Match/create logic (the canonical order)

Always **subject first, email fallback**:

```ts
// profile comes from sso.getUserProfile(token)
const identity = await UserIdentity.findOne({
  where: { provider: 'frappe', provider_subject: profile.subject },
  include: User,
});

let user = identity?.user;

// 2. Fallback by email — user exists (registered manually), link them
if (!user) {
  user = await User.findOne({ where: { email: profile.email } });
  if (user) {
    await UserIdentity.create({
      userId: user.id,
      provider: 'frappe',
      providerSubject: profile.subject,
      providerEmail: profile.email,
      metadata: { roles: profile.roles, raw: profile.raw },
    });
  }
}

// 3. Neither — create new user + identity
if (!user) {
  user = await User.create({
    email: profile.email,
    name: profile.name,
    image: profile.image,
    password: null,                    // SSO-only
  });
  await UserIdentity.create({
    userId: user.id,
    provider: 'frappe',
    providerSubject: profile.subject,
    providerEmail: profile.email,
    metadata: { roles: profile.roles, raw: profile.raw },
  });
}

// 4. Authorization — block inactive users
if (user.status !== 'AKTIF') {
  throw new Error('User is not active');
}

// 5. Session
req.session.userId = user.id;
```

## Design decisions

| Decision | Rationale |
|----------|-----------|
| `password` nullable | SSO-only user = no password. Manual user = has one. Hybrid = both. |
| `UNIQUE(provider, provider_subject)` | One Frappe account = one identity. Prevents duplicate linking. |
| Subject first, email fallback | Subject (`sub`) never changes. Email can change in Frappe. Fallback catches users who registered before SSO existed. |
| `metadata` JSONB | `roles`, raw profile — flexible, no migration when Frappe adds fields. |
| `ON DELETE CASCADE` | Deleting a user cleans up identities. |
| `status` on `users` | Block non-active users at login — check before session creation. |

## What does NOT belong here

- **`is_frappe` boolean** — redundant. Query `user_identities WHERE user_id = ? AND provider = 'frappe'` instead.
- **Access/refresh tokens** — if you need to call Frappe APIs later, store tokens in a dedicated `frappe_tokens` table (or cache), not in `user_identities`.

## Seeding / linked accounts UX (optional)

- **Link existing account**: after email fallback match, notify the user "your account has been linked" on first SSO login.
- **Unlink**: delete the row from `user_identities`. The `users` row stays.