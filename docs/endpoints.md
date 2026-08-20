# Frappe OAuth2/OIDC Endpoints

This document describes the OAuth2/OIDC endpoints exposed by a Frappe 16 website
when acting as an **authorization server** (OAuth provider).

## Discovery

Frappe exposes an OpenID Connect discovery document at:

```
GET {baseUrl}/.well-known/openid-configuration
```

The response includes:

| Field | Description |
|-------|-------------|
| `issuer` | The Frappe server URL |
| `authorization_endpoint` | URL for the authorization redirect |
| `token_endpoint` | URL for exchanging authorization codes for tokens |
| `userinfo_endpoint` | URL for fetching user profile with an access token |
| `revocation_endpoint` | URL for revoking tokens |
| `introspection_endpoint` | URL for inspecting tokens |
| `response_types_supported` | `code`, `token`, `code id_token`, etc. |
| `subject_types_supported` | `["public"]` |
| `id_token_signing_alg_values_supported` | `["HS256"]` |

## Endpoint paths (from Frappe source)

Based on the Frappe Framework `integrations/oauth2.py`, the standard paths are:

| Endpoint | Path |
|----------|------|
| Authorization | `/api/method/frappe.integrations.oauth2.authorize` |
| Token | `/api/method/frappe.integrations.oauth2.get_token` |
| Userinfo (OpenID profile) | `/api/method/frappe.integrations.oauth2.openid_profile` |
| Revocation | `/api/method/frappe.integrations.oauth2.revoke_token` |

> **Note:** `sso-frappe` uses OIDC discovery by default and does not hardcode these paths.
> The paths above are documented for reference and troubleshooting.

## PKCE Support

Frappe supports PKCE with `S256` code challenge method. The authorization code
stores `code_challenge` and `code_challenge_method`, and the token endpoint
validates `code_verifier` against the stored challenge.

Both `S256` and `plain` methods are supported, but `S256` is recommended.

## Scopes

When requesting the `openid` scope, Frappe internally expands it to:

- `Full Name`
- `Email`
- `User Image`
- `Roles`

This means the userinfo/profile response will include these fields when `openid`
is requested.

## Verification

Always verify the actual endpoints by fetching discovery metadata from your
specific Frappe instance:

```bash
curl -fsSL 'https://your-frappe.example.com/.well-known/openid-configuration' | jq .
```

Do not rely on hardcoded paths — Frappe versions or custom deployments may differ.
