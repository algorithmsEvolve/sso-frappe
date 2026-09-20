# Laravel integration

Package `sso-frappe/laravel` punya 2 mode:

- **Laravel**: pakai `laravel/socialite`
- **Lumen**: pakai standalone OAuth client dari package ini, tanpa Socialite

## Install

### Laravel

```bash
composer require sso-frappe/laravel laravel/socialite
```

### Lumen

```bash
composer require sso-frappe/laravel
```

## Configuration

```env
FRAPPE_SSO_BASE_URL=https://erp.example.com
FRAPPE_SSO_CLIENT_ID=<oauth-client-id>
FRAPPE_SSO_CLIENT_SECRET=<oauth-client-secret>
FRAPPE_SSO_REDIRECT_URI=https://app.example.com/auth/frappe/callback
```

## Laravel usage

Install Socialite, lalu register route seperti biasa:

```php
use Laravel\Socialite\Facades\Socialite;

Route::get('/auth/frappe', fn () => Socialite::driver('frappe')->redirect());

Route::get('/auth/frappe/callback', function () {
    $frappeUser = Socialite::driver('frappe')->user();

    // Cocokkan user lokal via provider_subject dulu, fallback email.
});
```

## Lumen usage

Lumen tidak pakai Socialite. Pakai standalone client:

```php
use SsoFrappe\Laravel\FrappeClient;

$client = app(FrappeClient::class);
$url = $client->authorizationUrl($state, $codeChallenge);
$token = $client->exchangeCode($code, $codeVerifier);
$profile = $client->getUserByToken($token['access_token']);
$user = $client->mapUser($profile);
```

## Notes

- `laravel/socialite` jadi dependency opsional untuk Laravel saja
- Lumen tidak perlu Socialite sama sekali
- Config publish tetap tersedia kalau `config_path()` ada
- Package ini tetap mendukung PKCE S256 dan `client_secret_post`

## Schema

See [database-schema.md](database-schema.md) — the recommended identity schema applies to both JS and Laravel.
