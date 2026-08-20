import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFrappeSSOBrowser, BROWSER_STORAGE_KEYS } from '../src/browser';

const validConfig = {
  baseUrl: 'https://erp.example.com',
  clientId: 'test-client-id',
  redirectUri: 'https://app.example.com/auth/callback',
} as const;

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
  };
}

describe('createFrappeSSOBrowser', () => {
  const originalLocation = globalThis.location;
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    vi.restoreAllMocks();
    storage = createMemoryStorage();

    // jsdom-less stub of window.location.assign
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { assign: vi.fn() } },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalLocation });
    delete (globalThis as { window?: unknown }).window;
    vi.restoreAllMocks();
  });

  it('creates a client without network I/O on construction', () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage });
    expect(sso).toBeDefined();
    expect(sso.startLogin).toBeInstanceOf(Function);
    expect(sso.handleCallback).toBeInstanceOf(Function);
    expect(sso.clear).toBeInstanceOf(Function);
  });

  it('does not expose exchangeCode or getUserProfile', () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage }) as unknown as Record<string, unknown>;
    expect(sso.exchangeCode).toBeUndefined();
    expect(sso.getUserProfile).toBeUndefined();
    expect(sso.clientSecret).toBeUndefined();
  });

  it('startLogin persists state+verifier and redirects to Frappe authorize endpoint', async () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage });
    const result = await sso.startLogin();

    expect(result.state).toBeTruthy();
    expect(result.codeVerifier).toBeTruthy();

    // persisted to storage
    expect(storage.setItem).toHaveBeenCalledWith(BROWSER_STORAGE_KEYS.state, result.state);
    expect(storage.setItem).toHaveBeenCalledWith(BROWSER_STORAGE_KEYS.codeVerifier, result.codeVerifier);

    // redirect happened
    const assignMock = (globalThis.window as unknown as { location: { assign: ReturnType<typeof vi.fn> } }).location.assign;
    const redirectUrl = assignMock.mock.calls[0][0] as string;
    const url = new URL(redirectUrl);

    expect(url.origin + url.pathname).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/auth/callback');
    expect(url.searchParams.get('state')).toBe(result.state);
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    // never includes client_secret
    expect(url.searchParams.get('client_secret')).toBeNull();
  });

  it('handleCallback validates state and returns code + verifier', async () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage });

    const started = await sso.startLogin();
    const callbackUrl = new URL('https://app.example.com/auth/callback');
    callbackUrl.searchParams.set('code', 'auth-code-123');
    callbackUrl.searchParams.set('state', started.state);

    const result = await sso.handleCallback(callbackUrl);
    expect(result.code).toBe('auth-code-123');
    expect(result.codeVerifier).toBe(started.codeVerifier);
    expect(result.state).toBe(started.state);
  });

  it('handleCallback throws on state mismatch (CSRF protection)', async () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage });
    await sso.startLogin();

    const callbackUrl = new URL('https://app.example.com/auth/callback');
    callbackUrl.searchParams.set('code', 'auth-code-123');
    callbackUrl.searchParams.set('state', 'attacker-state');

    await expect(sso.handleCallback(callbackUrl)).rejects.toThrow('OAuth state mismatch');
  });

  it('handleCallback throws when code is missing', async () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage });
    await sso.startLogin();

    const callbackUrl = new URL('https://app.example.com/auth/callback');
    callbackUrl.searchParams.set('state', 'anything');

    await expect(sso.handleCallback(callbackUrl)).rejects.toThrow('missing the authorization code');
  });

  it('clear removes persisted OAuth material', async () => {
    const sso = createFrappeSSOBrowser({ ...validConfig, storage });
    await sso.startLogin();

    sso.clear();
    expect(storage.removeItem).toHaveBeenCalledWith(BROWSER_STORAGE_KEYS.state);
    expect(storage.removeItem).toHaveBeenCalledWith(BROWSER_STORAGE_KEYS.codeVerifier);
  });

  it('supports explicit authorizationEndpoint override', async () => {
    const sso = createFrappeSSOBrowser({
      ...validConfig,
      authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
      storage,
    });

    const result = await sso.startLogin();
    const url = new URL(
      (globalThis.window as unknown as { location: { assign: ReturnType<typeof vi.fn> } }).location.assign.mock.calls[0][0],
    );
    expect(url.origin + url.pathname).toBe('https://auth.example.com/oauth2/authorize');
    expect(url.searchParams.get('state')).toBe(result.state);
  });
});
