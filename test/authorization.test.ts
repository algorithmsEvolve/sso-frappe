import { describe, it, expect } from 'vitest';
import { buildAuthorizationUrl } from '../src/oauth/authorization';

const baseInput = {
  authorizationEndpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
  clientId: 'test-client-id',
  redirectUri: 'https://app.example.com/api/auth/callback/frappe',
  scope: ['openid'] as readonly string[],
  state: 'test-state-123',
  usePkce: true,
} as const;

describe('buildAuthorizationUrl', () => {
  it('produces a valid URL with required OAuth params', () => {
    const result = buildAuthorizationUrl(baseInput);

    expect(result.url).toBeTruthy();
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(baseInput.authorizationEndpoint);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/api/auth/callback/frappe',
    );
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('state')).toBe('test-state-123');
  });

  it('includes PKCE challenge params when usePkce is true', () => {
    const result = buildAuthorizationUrl({
      ...baseInput,
      codeChallenge: 'test-challenge-abc',
    });

    const url = new URL(result.url);
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge-abc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('omits PKCE params when usePkce is false', () => {
    const result = buildAuthorizationUrl({
      ...baseInput,
      usePkce: false,
      codeChallenge: 'should-not-appear',
    });

    const url = new URL(result.url);
    expect(url.searchParams.get('code_challenge')).toBeNull();
    expect(url.searchParams.get('code_challenge_method')).toBeNull();
  });

  it('joins multiple scopes with space', () => {
    const result = buildAuthorizationUrl({
      ...baseInput,
      scope: ['openid', 'profile', 'email'],
    });

    const url = new URL(result.url);
    expect(url.searchParams.get('scope')).toBe('openid profile email');
  });

  it('never includes client_secret in the URL', () => {
    const result = buildAuthorizationUrl({
      ...baseInput,
      // @ts-expect-error testing runtime safety
      clientSecret: 'super-secret-value',
    });

    expect(result.url).not.toContain('super-secret-value');
    expect(result.url).not.toContain('client_secret');
  });
});
