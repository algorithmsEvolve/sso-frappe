import { FrappeSSOStateError } from '../errors';

/**
 * Generate a cryptographically random, URL-safe (base64url) state string.
 *
 * The consumer is responsible for storing this value (e.g. in a signed
 * short-lived cookie or session) and validating it on callback.
 */
export function createState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Validate that the received state matches the expected state.
 * Throws a typed error on mismatch — never returns a boolean.
 */
export function validateState(expected: string, received: string): void {
  if (!expected || !received) {
    throw new FrappeSSOStateError('OAuth state is missing');
  }
  if (expected !== received) {
    throw new FrappeSSOStateError('OAuth state mismatch');
  }
}

/** Encode bytes as base64url without padding (RFC 7636 / RFC 4648 §5). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
