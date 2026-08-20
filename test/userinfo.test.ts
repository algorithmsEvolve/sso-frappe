import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchUserInfo } from '../src/oauth/userinfo';
import { FrappeSSOProfileError } from '../src/errors';

const TOKEN = 'super-secret-access-token';
const URL_ = 'https://erp.example.com/oauth/userinfo';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('fetchUserInfo', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successful fetch returns parsed JSON', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    const payload = { sub: 'x', email: 'u@e.com' };
    fetchSpy.mockResolvedValue(jsonResponse(payload));

    const result = await fetchUserInfo({
      userInfoEndpoint: URL_,
      accessToken: TOKEN,
    });

    expect(result).toEqual(payload);
  });

  it('sends GET with Authorization: Bearer <token>', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));

    await fetchUserInfo({ userInfoEndpoint: URL_, accessToken: TOKEN });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(calledUrl).toBe(URL_);
    expect(init?.method).toBe('GET');
    expect(init?.headers).toEqual({
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    });
  });

  it('HTTP 401 throws FrappeSSOProfileError', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'invalid_token' }, 401));

    await expect(
      fetchUserInfo({ userInfoEndpoint: URL_, accessToken: TOKEN }),
    ).rejects.toThrow(FrappeSSOProfileError);
  });

  it('HTTP 500 throws FrappeSSOProfileError', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'server' }, 500));

    await expect(
      fetchUserInfo({ userInfoEndpoint: URL_, accessToken: TOKEN }),
    ).rejects.toThrow(FrappeSSOProfileError);
  });

  it('uses fetchWithTimeout with timeoutMs', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));

    await fetchUserInfo({
      userInfoEndpoint: URL_,
      accessToken: TOKEN,
      timeoutMs: 7500,
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    // fetchWithTimeout strips timeoutMs before calling fetch and passes a signal.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('error message never includes token value', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockResolvedValue(jsonResponse({}, 401));

    try {
      await fetchUserInfo({ userInfoEndpoint: URL_, accessToken: TOKEN });
      expect.fail('should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain(TOKEN);
    }
  });
});
