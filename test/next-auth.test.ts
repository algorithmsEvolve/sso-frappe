import { describe, it, expect } from 'vitest';
import { frappeNextAuthProvider } from '../src/next-auth';

const baseConfig = {
  baseUrl: 'https://erp.example.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://app.example.com/api/auth/callback/frappe',
  scope: ['openid'],
} as const;

describe('frappeNextAuthProvider', () => {
  it('returns provider with id "frappe"', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.id).toBe('frappe');
  });

  it('uses buttonLabel as provider name', () => {
    const provider = frappeNextAuthProvider({
      ...baseConfig,
      buttonLabel: 'Login with Visions',
    });
    expect(provider!.name).toBe('Login with Visions');
  });

  it('defaults name to "Login with Frappe"', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.name).toBe('Login with Frappe');
  });

  it('sets type to oauth', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.type).toBe('oauth');
  });

  it('sets explicit authorization endpoint URL', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.authorization.url).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
    );
  });

  it('sets explicit token endpoint URL', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.token.url).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.get_token',
    );
  });

  it('sets explicit userinfo endpoint URL', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.userinfo.url).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.openid_profile',
    );
  });

  it('passes clientId and clientSecret', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    expect(provider!.clientId).toBe('test-client-id');
    expect(provider!.clientSecret).toBe('test-client-secret');
  });

  it('joins scopes with space in authorization params', () => {
    const provider = frappeNextAuthProvider({
      ...baseConfig,
      scope: ['openid', 'profile', 'email'],
    });
    expect(provider!.authorization.params.scope).toBe('openid profile email');
  });

  it('profile() normalizes Frappe userinfo to NextAuth shape', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    const result = provider!.profile({
      sub: 'user-123',
      email: 'Test.User@Example.COM',
      full_name: 'Test User',
      username: 'testuser',
      user_image: 'https://erp.example.com/avatar.png',
      roles: ['Desk User', 'Website Manager'],
    });

    expect(result.id).toBe('user-123');
    expect(result.name).toBe('Test User');
    expect(result.email).toBe('test.user@example.com');
    expect(result.image).toBe('https://erp.example.com/avatar.png');
    expect(result.frappeUsername).toBe('testuser');
    expect(result.frappeRoles).toEqual(['Desk User', 'Website Manager']);
  });

  it('profile() falls back to email local-part when name missing', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    const result = provider!.profile({
      sub: 'user-123',
      email: 'john.doe@example.com',
    });

    expect(result.name).toBe('john.doe');
  });

  it('profile() handles missing email gracefully', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    const result = provider!.profile({
      sub: 'user-123',
      full_name: 'No Email User',
    });

    expect(result.email).toBeNull();
    expect(result.name).toBe('No Email User');
  });

  it('profile() returns empty roles array when roles not present', () => {
    const provider = frappeNextAuthProvider(baseConfig);
    const result = provider!.profile({
      sub: 'user-123',
      email: 'test@example.com',
    });

    expect(result.frappeRoles).toEqual([]);
  });

  it('returns null when required fields missing', () => {
    const provider = frappeNextAuthProvider({
      ...baseConfig,
      baseUrl: '',
    });
    expect(provider).toBeNull();
  });
});
