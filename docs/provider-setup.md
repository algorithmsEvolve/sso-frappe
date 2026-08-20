# Frappe Provider Setup

This guide explains how to configure a Frappe website to act as an OAuth2/OIDC provider.

## 1. Create an OAuth Client in Frappe

In your Frappe site, go to:

```
Desk → Integrations → OAuth2 Settings → Add New
```

Fill in:

| Field | Value |
|-------|-------|
| **Client ID** | Your chosen client ID (or auto-generated) |
| **Client Secret** | Your chosen secret (or auto-generated) |
| **Redirect URIs** | `https://your-app.example.com/api/auth/callback/frappe` |
| **Scopes** | `openid` (Frappe auto-expands to Full Name, Email, User Image, Roles) |
| **Skip Authorization** | No (unless you want implicit flow) |

## 2. Verify Discovery Endpoint

```bash
curl -fsSL 'https://your-frappe.example.com/.well-known/openid-configuration' | jq .
```

You should see:

```json
{
  "issuer": "https://your-frappe.example.com",
  "authorization_endpoint": "https://your-frappe.example.com/api/method/frappe.integrations.oauth2.authorize",
  "token_endpoint": "https://your-frappe.example.com/api/method/frappe.integrations.oauth2.get_token",
  "userinfo_endpoint": "https://your-frappe.example.com/api/method/frappe.integrations.oauth2.openid_profile"
}
```

## 3. Set Environment Variables in Your App

```env
FRAPPE_SSO_BASE_URL=https://your-frappe.example.com
FRAPPE_SSO_CLIENT_ID=<from step 1>
FRAPPE_SSO_CLIENT_SECRET=<from step 1>
```

## 4. Test the Login Flow

1. Visit your app's login page
2. Click "Login with Frappe"
3. You should be redirected to the Frappe authorization page
4. After approving, you'll be redirected back to your app

## Troubleshooting

- **"Discovery metadata is missing authorization_endpoint"** — Your Frappe version may not support OIDC discovery. Provide explicit endpoints via `authorizationEndpoint`, `tokenEndpoint`, `userInfoEndpoint` in your config.
- **"OAuth state mismatch"** — Ensure your `NEXTAUTH_URL` matches the actual URL users visit (including protocol and port).
- **"Token exchange failed"** — Verify `clientSecret` is correct and the redirect URI exactly matches what's configured in Frappe.
