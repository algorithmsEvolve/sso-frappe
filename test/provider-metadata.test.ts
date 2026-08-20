import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveProviderEndpoints } from '../src/providers/frappe';
import { FrappeSSODiscoveryError } from '../src/errors';

const mockDiscovery = {
  issuer: 'https://erp.example.com',
  authorization_endpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
  token_endpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.get_token',
  userinfo_endpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.openid_profile',
  response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'],
};

describe('resolveProviderEndpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --- explicit overrides (no network) ---

  it('uses explicit endpoint overrides without network calls', async () => {
    const result = await resolveProviderEndpoints({
      baseUrl: 'https://erp.example.com',
      authorizationEndpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
      tokenEndpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.get_token',
      userInfoEndpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.openid_profile',
      discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
      timeoutMs: 5000,
    });

    expect(result.authorizationEndpoint).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.authorize',
    );
    expect(result.tokenEndpoint).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.get_token',
    );
    expect(result.userInfoEndpoint).toBe(
      'https://erp.example.com/api/method/frappe.integrations.oauth2.openid_profile',
    );
  });

  it('returns authorization/token instantly when both overrides are provided', async () => {
    const result = await resolveProviderEndpoints({
      baseUrl: 'https://erp.example.com',
      authorizationEndpoint: 'https://custom/auth',
      tokenEndpoint: 'https://custom/token',
      discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
      timeoutMs: 5000,
    });

    expect(result.authorizationEndpoint).toBe('https://custom/auth');
    expect(result.tokenEndpoint).toBe('https://custom/token');
  });

  // --- discovery ---

  it('fetches discovery metadata when endpoints are not overridden', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await resolveProviderEndpoints({
      baseUrl: 'https://erp.example.com',
      discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
      timeoutMs: 5000,
    });

    expect(result.authorizationEndpoint).toBe(mockDiscovery.authorization_endpoint);
    expect(result.tokenEndpoint).toBe(mockDiscovery.token_endpoint);
    expect(result.userInfoEndpoint).toBe(mockDiscovery.userinfo_endpoint);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('override wins over discovery value', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockDiscovery), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await resolveProviderEndpoints({
      baseUrl: 'https://erp.example.com',
      authorizationEndpoint: 'https://override/auth',
      discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
      timeoutMs: 5000,
    });

    expect(result.authorizationEndpoint).toBe('https://override/auth');
    // token still comes from discovery
    expect(result.tokenEndpoint).toBe(mockDiscovery.token_endpoint);
  });

  // --- failures ---

  it('throws discovery error on 404 when required endpoints missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    await expect(
      resolveProviderEndpoints({
        baseUrl: 'https://erp.example.com',
        discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(FrappeSSODiscoveryError);
  });

  it('throws error when discovery returns missing authorization_endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ token_endpoint: 'https://x/token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      resolveProviderEndpoints({
        baseUrl: 'https://erp.example.com',
        discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(FrappeSSODiscoveryError);
  });

  it('throws error when discovery returns missing token_endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ authorization_endpoint: 'https://x/auth' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      resolveProviderEndpoints({
        baseUrl: 'https://erp.example.com',
        discoveryEndpoint: 'https://erp.example.com/.well-known/openid-configuration',
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(FrappeSSODiscoveryError);
  });
});
