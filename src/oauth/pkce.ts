import { base64UrlEncode } from './state';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/**
 * Generate a PKCE (Proof Key for Code Exchange) pair using S256 method.
 *
 * - code_verifier: 32 random bytes → base64url (43 chars)
 * - code_challenge: base64url(sha256(code_verifier))
 *
 * The consumer stores `codeVerifier` securely (e.g. in a signed cookie)
 * and sends `codeChallenge` in the authorization URL.
 */
export async function createPkcePair(): Promise<PkcePair> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}
