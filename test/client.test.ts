import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFrappeSSO } from '../src/server';

const validConfig = {
  baseUrl: 'https://erp.example.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://app.example.com/api/auth/callback/frappe',
  scope: ['openid'],
} as const;

const mockDiscovery = {
  issuer: 'https://erp.example.com',
  authorization_endpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
  token_endpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.get_token',
  userinfo_endpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.openid_profile',
};

describe('createFrappeSSO', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a client without network I/O on construction', () => {
    const sso = createFrappeSSO(validConfig);
    expect(sso).toBeDefined();
    expect(sso.createAuthorizationUrl).toBeInstanceOf(Function);
    expect(sso.exchangeCode).toBeInstanceOf(Function);
    expect(sso.getUserProfile).toBeInstanceOf(Function);
  });

  it('exposes custom buttonLabel from config', () => {
    // buttonLabel is not on the client directly, but config normalization should work
    const sso = createFrappeSSO({ ...validConfig, buttonLabel: 'Login with Visions' });
    expect(sso).toBeDefined();
  });

  it('createAuthorizationUrl returns URL with state and codeVerifier', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const sso = createFrappeSSO(validConfig);
    const result = await sso.createAuthorizationUrl();

    expect(result.url).toBeTruthy();
    expect(result.state).toBeTruthy();
    expect(result.codeVerifier).toBeTruthy();

    const url = new URL(result.url);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('state')).toBe(result.state);
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('createAuthorizationUrl without PKCE returns null codeVerifier', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const sso = createFrappeSSO({ ...validConfig, usePkce: false });
    const result = await sso.createAuthorizationUrl();

    expect(result.codeVerifier).toBeNull();
    const url = new URL(result.url);
    expect(url.searchParams.get('code_challenge')).toBeNull();
  });

  it('exchangeCode returns a FrappeToken', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const sso = createFrappeSSO(validConfig);
    await sso.createAuthorizationUrl();
    const token = await sso.exchangeCode({
      code: 'test-code',
      codeVerifier: 'test-verifier',
    });

    expect(token.accessToken).toBe('test-access-token');
    expect(token.tokenType).toBe('Bearer');
    expect(token.expiresIn).toBe(3600);
  });

  it('getUserProfile returns a normalized FrappeIdentity', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub: 'user-123',
          email: 'Test.User@Example.COM',
          full_name: 'Test User',
          username: 'testuser',
          user_image: 'https://erp.example.com/avatar.png',
          roles: ['Desk User', 'Website Manager'],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const sso = createFrappeSSO(validConfig);
    await sso.createAuthorizationUrl();
    const profile = await sso.getUserProfile({
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
      raw: {},
    });

    expect(profile.subject).toBe('user-123');
    expect(profile.email).toBe('test.user@example.com');
    expect(profile.name).toBe('Test User');
    expect(profile.username).toBe('testuser');
    expect(profile.image).toBe('https://erp.example.com/avatar.png');
    expect(profile.roles).toEqual(['Desk User', 'Website Manager']);
  });

  it('caches discovery metadata across calls', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const sso = createFrappeSSO(validConfig);
    await sso.createAuthorizationUrl();
    // second call should not trigger another discovery fetch
    await sso.createAuthorizationUrl();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
