import { describe, it, expect } from 'vitest';
import { createPkcePair } from '../src/oauth/pkce';

describe('createPkcePair', () => {
  it('produces codeVerifier and codeChallenge', async () => {
    const pair = await createPkcePair();

    expect(pair.codeVerifier).toBeTruthy();
    expect(pair.codeChallenge).toBeTruthy();
    expect(pair.codeChallengeMethod).toBe('S256');
  });

  it('produces URL-safe verifier (base64url charset)', async () => {
    const pair = await createPkcePair();
    // RFC 7636: 43-128 chars, unreserved chars [A-Z][a-z][0-9]-._~
    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9-._~]+$/);
    expect(pair.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it('produces URL-safe challenge without padding', async () => {
    const pair = await createPkcePair();
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pair.codeChallenge).not.toContain('=');
  });

  it('challenge is SHA-256 of verifier (43 chars for 32-byte input)', async () => {
    const pair = await createPkcePair();
    // S256 challenge = base64url(sha256(verifier))
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(pair.codeVerifier),
    );
    const expected = btoa(
      String.fromCharCode(...new Uint8Array(digest)),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(pair.codeChallenge).toBe(expected);
  });

  it('produces unique pairs on subsequent calls', async () => {
    const p1 = await createPkcePair();
    const p2 = await createPkcePair();
    expect(p1.codeVerifier).not.toBe(p2.codeVerifier);
    expect(p1.codeChallenge).not.toBe(p2.codeChallenge);
  });
});
