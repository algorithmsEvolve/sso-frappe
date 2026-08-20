import { describe, it, expect } from 'vitest';
import { createState, validateState } from '../src/oauth/state';
import { FrappeSSOStateError } from '../src/errors';

describe('createState', () => {
  it('produces a non-empty string', () => {
    const state = createState();
    expect(state).toBeTruthy();
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('produces unique values on subsequent calls', () => {
    const s1 = createState();
    const s2 = createState();
    const s3 = createState();
    expect(s1).not.toBe(s2);
    expect(s2).not.toBe(s3);
    expect(s1).not.toBe(s3);
  });

  it('produces URL-safe strings', () => {
    for (let i = 0; i < 20; i++) {
      const state = createState();
      // base64url alphabet only
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('validateState', () => {
  it('does not throw when state matches', () => {
    const state = createState();
    expect(() => validateState(state, state)).not.toThrow();
  });

  it('throws FrappeSSOStateError on mismatch', () => {
    expect(() => validateState('expected', 'received')).toThrow(
      FrappeSSOStateError,
    );
  });

  it('throws on empty expected', () => {
    expect(() => validateState('', 'something')).toThrow(FrappeSSOStateError);
  });

  it('throws on empty received', () => {
    expect(() => validateState('something', '')).toThrow(FrappeSSOStateError);
  });

  it('throws on both empty', () => {
    expect(() => validateState('', '')).toThrow(FrappeSSOStateError);
  });
});
