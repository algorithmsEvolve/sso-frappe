import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exchangeCode } from '../src/oauth/token';
import { FrappeSSOTokenError } from '../src/errors';
import * as http from '../src/http';

const baseInput = {
  tokenEndpoint: 'https://erp.example.com/api/method/frappe.integrations.oauth2.get_token',
  clientId: 'client-123',
  clientSecret: 'secret-abc',
  redirectUri: 'https://app.example.com/api/auth/callback/frappe',
  code: 'auth-code-xyz',
  codeVerifier: 'verifier-123',
  timeoutMs: 5000,
};

const okBody = {
  access_token: 'access-token-xyz',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'refresh-token-xyz',
  id_token: 'id-token-xyz',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('exchangeCode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns FrappeToken with accessToken, tokenType, and raw on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(okBody));

    const token = await exchangeCode(baseInput);

    expect(token.accessToken).toBe('access-token-xyz');
    expect(token.tokenType).toBe('Bearer');
    expect(token.expiresIn).toBe(3600);
    expect(token.refreshToken).toBe('refresh-token-xyz');
    expect(token.idToken).toBe('id-token-xyz');
    expect(token.raw).toEqual(okBody);
  });

  it('sends POST form-urlencoded with all required fields', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(okBody));

    await exchangeCode(baseInput);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(baseInput.tokenEndpoint);
    expect(init?.method).toBe('POST');

    const body = init?.body as string;
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('auth-code-xyz');
    expect(params.get('redirect_uri')).toBe(baseInput.redirectUri);
    expect(params.get('client_id')).toBe('client-123');
    expect(params.get('client_secret')).toBe('secret-abc');
    expect(params.get('code_verifier')).toBe('verifier-123');

    const headers = init?.headers as Record<string, string>;
    const ctKey = Object.keys(headers).find(
      (k) => k.toLowerCase() === 'content-type',
    );
    expect(headers[ctKey!]).toBe('application/x-www-form-urlencoded');
  });

  it('throws FrappeSSOTokenError on HTTP 400', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_grant' }, 400),
    );

    await expect(exchangeCode(baseInput)).rejects.toThrow(FrappeSSOTokenError);
  });

  it('throws FrappeSSOTokenError on HTTP 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    await expect(exchangeCode(baseInput)).rejects.toThrow(FrappeSSOTokenError);
  });

  it('throws FrappeSSOTokenError when access_token is missing from response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ token_type: 'Bearer' }),
    );

    await expect(exchangeCode(baseInput)).rejects.toThrow(FrappeSSOTokenError);
  });

  it('never includes the client secret in the error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_client' }, 400),
    );

    try {
      await exchangeCode(baseInput);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FrappeSSOTokenError);
      expect((err as Error).message).not.toContain('secret-abc');
    }
  });

  it('uses fetchWithTimeout from ../http with timeoutMs', async () => {
    const httpSpy = vi
      .spyOn(http, 'fetchWithTimeout')
      .mockResolvedValueOnce(jsonResponse(okBody));

    await exchangeCode({ ...baseInput, timeoutMs: 7500 });

    expect(httpSpy).toHaveBeenCalledOnce();
    const init = httpSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(init.timeoutMs).toBe(7500);
  });
});
