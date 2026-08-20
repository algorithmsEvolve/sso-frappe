# Browser client API

Import:

```ts
import {
  createFrappeSSOBrowser,
  BROWSER_STORAGE_KEYS,
} from 'sso-frappe/browser';
```

## Security boundary

The browser client accepts **no `clientSecret`** and has **no `exchangeCode`** or `getUserProfile` method. It handles only:

1. Generate state and PKCE S256
2. Store state + verifier in `sessionStorage`
3. Redirect to Frappe
4. Parse callback URL
5. Validate state
6. Return `{ code, codeVerifier }` to your backend

Your backend receives those values and uses `sso-frappe/server` to exchange the code. Never put a Frappe client secret in `VITE_*`, `NEXT_PUBLIC_*`, or any browser bundle.

## Configuration

```ts
const sso = createFrappeSSOBrowser({
  baseUrl: 'https://erp.example.com',
  clientId: 'public-client-id',
  redirectUri: 'https://app.example.com/auth/callback',
  scope: ['openid'],
  // optional; defaults to Frappe's standard path
  authorizationEndpoint:
    'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
  buttonLabel: 'Login with Frappe',
});
```

`baseUrl`, `clientId`, and `redirectUri` are required. PKCE is always enabled in browser mode.

## `startLogin()`

```ts
const { state, codeVerifier } = await sso.startLogin();
```

Persists:

- `frappe_sso_state`
- `frappe_sso_code_verifier`

in `sessionStorage`, then calls `window.location.assign(authorizationUrl)`.

## `handleCallback(url?)`

On callback page:

```ts
const { code, codeVerifier, state } = await sso.handleCallback();

await fetch('/api/auth/frappe/callback', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, codeVerifier, state }),
});

sso.clear();
```

Pass a URL explicitly in tests or non-browser runtimes:

```ts
await sso.handleCallback('https://app.example.com/auth/callback?code=...&state=...');
```

Throws `FrappeSSOStateError` if code/state/verifier is missing or state mismatches.

## `clear()`

Remove state and PKCE verifier after successful callback or failed/cancelled flow:

```ts
sso.clear();
```

## Custom storage

Useful for tests, SSR guards, or custom storage:

```ts
const sso = createFrappeSSOBrowser({
  baseUrl,
  clientId,
  redirectUri,
  storage: {
    getItem: (key) => sessionStorage.getItem(key),
    setItem: (key, value) => sessionStorage.setItem(key, value),
    removeItem: (key) => sessionStorage.removeItem(key),
  },
});
```

Do not use a server database or shared storage for browser secrets. `sessionStorage` is scoped to the tab, which prevents verifier collisions between tabs.
