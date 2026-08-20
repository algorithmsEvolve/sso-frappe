# Laravel integration — separate Composer package

> **Status:** Planned. `sso-frappe-laravel` will be built as a separate Composer package after the JS/TS package is stable.

PHP cannot import an npm package. The Laravel adapter lives in its own repository and is distributed via Composer/Packagist, while this repo documents the shared conventions and links to it.

## Planned package

```bash
composer require sso-frappe/laravel
```

Built on **Laravel Socialite** (the de-facto OAuth client in Laravel), not raw Guzzle controllers and not `socialiteproviders/manager`.

### Why Socialite

| Frappe quirk | Socialite behavior |
|--------------|--------------------|
| Token endpoint requires `client_secret_post` | Socialite sends credentials in POST body by default |
| Frappe `id_token` uses HS256 | Socialite ignores `id_token`; uses userinfo |
| Frappe discovery may return HTTP issuer | Socialite does not use discovery; provider uses explicit endpoints |
| State/CSRF | Socialite handles via session |

## Planned package structure

```text
sso-frappe-laravel/
├── composer.json
├── src/
│   ├── FrappeProvider.php
│   ├── FrappeServiceProvider.php
│   └── FrappeUser.php
├── tests/
│   ├── FrappeProviderTest.php
│   └── ProfileMappingTest.php
├── README.md
└── LICENSE
```

## Planned configuration

```php
// config/services.php
'frappe' => [
    'base_url' => env('FRAPPE_SSO_BASE_URL'),
    'client_id' => env('FRAPPE_SSO_CLIENT_ID'),
    'client_secret' => env('FRAPPE_SSO_CLIENT_SECRET'),
    'redirect' => env('FRAPPE_SSO_REDIRECT_URI'),
],
```

```env
FRAPPE_SSO_BASE_URL=https://erp.example.com
FRAPPE_SSO_CLIENT_ID=<oauth-client-id>
FRAPPE_SSO_CLIENT_SECRET=<oauth-client-secret>
FRAPPE_SSO_REDIRECT_URI=https://app.example.com/auth/frappe/callback
```

## Planned usage

```php
// routes/web.php
use Laravel\Socialite\Facades\Socialite;
use App\Http\Controllers\FrappeLoginController;

Route::get('/auth/frappe', fn () =>
    Socialite::driver('frappe')->redirect()
)->name('frappe.login');

Route::get('/auth/frappe/callback', FrappeLoginController::class)
    ->name('frappe.callback');
```

```php
// app/Http/Controllers/FrappeLoginController.php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserIdentity;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Facades\Socialite;

class FrappeLoginController extends Controller
{
    public function __invoke()
    {
        $frappe = Socialite::driver('frappe')->user();

        $user = DB::transaction(function () use ($frappe) {
            // Pattern C: subject first
            $identity = UserIdentity::query()
                ->where('provider', 'frappe')
                ->where('provider_subject', $frappe->getId())
                ->first();

            if ($identity) {
                return $identity->user;
            }

            // Email fallback — link existing manual user
            $user = User::query()->firstOrCreate(
                ['email' => strtolower($frappe->getEmail())],
                [
                    'name' => $frappe->getName(),
                    'password' => null,
                    'status' => 'AKTIF',
                ],
            );

            $user->identities()->create([
                'provider' => 'frappe',
                'provider_subject' => $frappe->getId(),
                'provider_email' => strtolower($frappe->getEmail()),
                'metadata' => [
                    'roles' => $frappe->roles ?? [],
                ],
            ]);

            return $user;
        });

        abort_unless($user->status === 'AKTIF', 403);

        Auth::login($user, remember: true);
        request()->session()->regenerate();

        return redirect()->intended('/dashboard');
    }
}
```

Schema: see [docs/database-schema.md](database-schema.md) — same Pattern C across JS and Laravel.

## Package responsibilities

### Package handles

- Frappe authorization/token/userinfo endpoints
- Socialite provider registration
- Frappe profile normalization (`id`, `email`, `name`, `avatar`, `roles`)
- OAuth state via Socialite session
- Typed exceptions without exposing secrets

### Consumer handles

- `users` and `user_identities` schema/migrations
- Match/create/link local users
- Role mapping
- Active/inactive checks
- Session/login redirect
- Authorization rules

## Version scope for first release

- PHP `^8.2`
- Laravel `^11.0|^12.0`
- Laravel Socialite `^5.0`
- Package version `0.1.0`

## Open questions before implementation

We will decide these in the Laravel planning/brainstorm session:

1. **Package namespace/name**: `sso-frappe/laravel` vs `akbariski/sso-frappe-laravel`
2. **Laravel support**: 11 + 12 only, or include Laravel 10?
3. **PKCE**: required vs optional for confidential clients (Socialite version support)
4. **Provider registration**: Laravel package auto-discovery via service provider vs manual setup
5. **Profile roles API**: property (`$user->roles`) vs method (`$user->getRoles()`)
6. **Testing**: PHPUnit + Orchestra Testbench (recommended) vs Pest
7. **Publishing**: Packagist name availability

Nothing in this repo will be coupled to Laravel implementation details — env names, profile fields, and identity schema stay aligned.