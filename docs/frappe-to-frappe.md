# Frappe → Frappe (Social Login Key)

If **both** the consumer and provider are Frappe instances, you do **not** need `sso-frappe` at all. Frappe has a built-in "Social Login Key" feature — configure it in the UI.

## Setup

In the consumer Frappe site:

```
Frappe Desk → Website → Social Login Key → New
```

| Field | Value |
|-------|-------|
| **Enable Social Login** | ✅ |
| **Client ID** | The `client_id` from the provider Frappe's OAuth Client |
| **Client Secret** | The `client_secret` from the provider |
| **Frappe Server URL** | `https://provider-frappe.example.com` |
| **Base URL** | `https://consumer-frappe.example.com` |
| **Provider** | `Frappe` |

On the provider Frappe site, create an OAuth Client that whitelists the consumer's redirect URL:

```
Provider Desk → Integrations → OAuth2 Settings → New
```

| Field | Value |
|-------|-------|
| **Client ID** | Any (e.g. auto-generated) |
| **Client Secret** | Any |
| **Redirect URIs** | `https://consumer-frappe.example.com/api/method/frappe.integrations.oauth2.authorize` (the consumer's Social Login Key base URL) |

How Frappe's built-in flow works:

- Consumer Frappe shows a "Login with Frappe" button on its login page
- User is redirected to to provider Frappe, logs in, consents
- Provider redirects back to the consumer with an OAuth code
- Consumer Frappe exchanges the code and logs the user in automatically

## Notes

- The user must exist in the consumer site (or be auto-created via Frappe's system settings — check `Website Settings → Add Social Login On Website`).
- Both sites need HTTPS or matching local dev settings.
- This is **zero code** — no package, no server route, no PKCE handling. Frappe manages everything internally.

## When NOT to use this

Use `sso-frappe` when the consumer is **not** a Frappe app — Next.js, React, Vue, Nuxt, Laravel, Node.js. The Social Login Key only exists inside Frappe itself.