# Vue SPA + backend proxy

Same architecture as React — `sso-frappe/browser` on the client, `sso-frappe/server` on your backend.

## Frontend env vars

```env
VITE_FRAPPE_SSO_BASE_URL=https://erp.example.com
VITE_FRAPPE_SSO_CLIENT_ID=<oauth-client-id>
VITE_FRAPPE_SSO_REDIRECT_URI=http://localhost:5173/auth/callback
```

## 1. Composable

```ts
// src/composables/useFrappeSSO.ts
import { createFrappeSSOBrowser } from 'sso-frappe/browser';

const sso = createFrappeSSOBrowser({
  baseUrl: import.meta.env.VITE_FRAPPE_SSO_BASE_URL,
  clientId: import.meta.env.VITE_FRAPPE_SSO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_FRAPPE_SSO_REDIRECT_URI,
  allowInsecureHttp: true, // local dev
});

export function useFrappeSSO() {
  return {
    startLogin: () => sso.startLogin(),
    handleCallback: () => sso.handleCallback(),
    clear: () => sso.clear(),
  };
}
```

## 2. Login button (built-in style)

```vue
<!-- src/components/FrappeLoginButton.vue -->
<script setup lang="ts">
import { useFrappeSSO } from '@/composables/useFrappeSSO';

const { startLogin } = useFrappeSSO();
</script>

<template>
  <button
    @click="startLogin"
    class="rounded-lg bg-slate-900 px-4 py-2 text-white"
  >
    <slot>Login with Frappe</slot>
  </button>
</template>
```

Use it:

```vue
<FrappeLoginButton />
<!-- or custom label -->
<FrappeLoginButton>Masuk dengan akun perusahaan</FrappeLoginButton>
```

## 3. Custom button (headless)

```vue
<!-- src/components/CustomLogin.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useFrappeSSO } from '@/composables/useFrappeSSO';

const { startLogin } = useFrappeSSO();
const loading = ref(false);

async function handleLogin() {
  loading.value = true;
  await startLogin();
}
</script>

<template>
  <button
    :disabled="loading"
    @click="handleLogin"
    class="my-custom-class"
  >
    {{ loading ? 'Menghubungkan...' : 'Login via SSO' }}
  </button>
</template>
```

## 4. Callback page

```vue
<!-- src/pages/FrappeCallback.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFrappeSSO } from '@/composables/useFrappeSSO';

const router = useRouter();
const { handleCallback, clear } = useFrappeSSO();
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const { code, codeVerifier } = await handleCallback();

    const res = await fetch('/api/auth/frappe/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, codeVerifier }),
    });

    if (!res.ok) throw new Error('SSO callback failed');

    clear();
    router.push('/dashboard');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});
</script>

<template>
  <p v-if="error">Login failed: {{ error }}</p>
  <p v-else>Finishing login...</p>
</template>
```

## 5. Backend

Identical to the Express/NestJS example in [React backend example](react.md#3-express-backend). The backend is framework-agnostic — Vue just sends `{ code, codeVerifier }` via `fetch`.

## Pinia store (optional)

If you prefer a store-based approach:

```ts
// src/stores/auth.ts
import { defineStore } from 'pinia';
import { useFrappeSSO } from '@/composables/useFrappeSSO';

export const useAuthStore = defineStore('auth', () => {
  const { startLogin, handleCallback, clear } = useFrappeSSO();

  async function loginWithFrappe() {
    await startLogin();
  }

  async function completeFrappeCallback() {
    const { code, codeVerifier } = await handleCallback();
    const res = await fetch('/api/auth/frappe/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, codeVerifier }),
    });
    if (!res.ok) throw new Error('SSO callback failed');
    clear();
  }

  return { loginWithFrappe, completeFrappeCallback };
});
```
