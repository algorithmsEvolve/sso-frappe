import { describe, it, expect } from 'vitest';
import { defineFrappeSSOConfig } from '../src/config';
import { FrappeSSOConfigError } from '../src/errors';

const validBase = {
  baseUrl: 'https://erp.example.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://app.example.com/api/auth/callback/frappe',
  scope: ['openid'],
} as const;

describe('defineFrappeSSOConfig', () => {
  // --- valid config normalizes correctly ---

  it('normalizes a valid config with all defaults', () => {
    const config = defineFrappeSSOConfig(validBase);

    expect(config.baseUrl).toBe('https://erp.example.com');
    expect(config.clientId).toBe('test-client-id');
    expect(config.redirectUri).toBe('https://app.example.com/api/auth/callback/frappe');
    expect(config.scope).toEqual(['openid']);
    expect(config.usePkce).toBe(true);
    expect(config.timeoutMs).toBe(10_000);
    expect(config.buttonLabel).toBe('Login with Frappe');
    expect(config.allowInsecureHttp).toBe(false);
    expect(config.discoveryEndpoint).toBe(
      'https://erp.example.com/.well-known/openid-configuration',
    );
  });

  it('removes trailing slash from baseUrl', () => {
    const config = defineFrappeSSOConfig({
      ...validBase,
      baseUrl: 'https://erp.example.com/',
    });
    expect(config.baseUrl).toBe('https://erp.example.com');
  });

  it('preserves custom buttonLabel', () => {
    const config = defineFrappeSSOConfig({
      ...validBase,
      buttonLabel: 'Login with Visions',
    });
    expect(config.buttonLabel).toBe('Login with Visions');
  });

  it('defaults scope to [openid] when caller omits scope', () => {
    const { scope, ...noScope } = validBase;
    const config = defineFrappeSSOConfig(noScope);
    expect(config.scope).toEqual(['openid']);
  });

  it('preserves explicit endpoint overrides', () => {
    const config = defineFrappeSSOConfig({
      ...validBase,
      authorizationEndpoint: 'https://custom.example.com/auth',
      tokenEndpoint: 'https://custom.example.com/token',
      userInfoEndpoint: 'https://custom.example.com/userinfo',
      discoveryEndpoint: 'https://custom.example.com/.well-known/openid-configuration',
    });
    expect(config.authorizationEndpoint).toBe('https://custom.example.com/auth');
    expect(config.tokenEndpoint).toBe('https://custom.example.com/token');
    expect(config.userInfoEndpoint).toBe('https://custom.example.com/userinfo');
    expect(config.discoveryEndpoint).toBe(
      'https://custom.example.com/.well-known/openid-configuration',
    );
  });

  // --- invalid config ---

  it('rejects missing baseUrl', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, baseUrl: '' }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects missing clientId', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, clientId: '' }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects missing redirectUri', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, redirectUri: '' }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects empty scope array', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, scope: [] }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects non-absolute baseUrl', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, baseUrl: 'not-a-url' }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects non-absolute redirectUri', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, redirectUri: '/callback' }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects http URLs by default (insecure)', () => {
    expect(() =>
      defineFrappeSSOConfig({
        ...validBase,
        baseUrl: 'http://localhost:8080',
        redirectUri: 'http://localhost:3000/callback',
      }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('allows http URLs when allowInsecureHttp is true', () => {
    expect(() =>
      defineFrappeSSOConfig({
        ...validBase,
        baseUrl: 'http://localhost:8080',
        redirectUri: 'http://localhost:3000/callback',
        allowInsecureHttp: true,
      }),
    ).not.toThrow();
  });

  it('rejects blank buttonLabel', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, buttonLabel: '   ' }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects non-positive timeoutMs', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, timeoutMs: 0 }),
    ).toThrow(FrappeSSOConfigError);
  });

  it('rejects unreasonably large timeoutMs', () => {
    expect(() =>
      defineFrappeSSOConfig({ ...validBase, timeoutMs: 999_999_999 }),
    ).toThrow(FrappeSSOConfigError);
  });

  // --- secret safety ---

  it('does not include clientSecret in error messages', () => {
    try {
      defineFrappeSSOConfig({ ...validBase, baseUrl: '' });
      expect.fail('should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain('test-client-secret');
    }
  });
});
