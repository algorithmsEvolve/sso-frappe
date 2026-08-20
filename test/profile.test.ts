import { describe, it, expect } from 'vitest';
import { normalizeProfile } from '../src/profile';
import { FrappeSSOProfileError } from '../src/errors';

describe('normalizeProfile', () => {
  it('normal profile with sub, email, full_name → normalized identity', () => {
    const raw = {
      sub: 'abc123',
      email: 'user@example.com',
      full_name: 'Jane Doe',
    };
    const id = normalizeProfile(raw);
    expect(id.subject).toBe('abc123');
    expect(id.email).toBe('user@example.com');
    expect(id.name).toBe('Jane Doe');
  });

  it('email is trimmed and lowercased', () => {
    const raw = { sub: 's1', email: '  User@Example.COM  ', full_name: 'N' };
    const id = normalizeProfile(raw);
    expect(id.email).toBe('user@example.com');
  });

  it('missing email → throws FrappeSSOProfileError (email required)', () => {
    expect(() =>
      normalizeProfile({ sub: 's1', full_name: 'N' }),
    ).toThrow(FrappeSSOProfileError);
  });

  it('full_name missing, name present → uses name', () => {
    const raw = { sub: 's1', email: 'u@e.com', name: 'FromName' };
    const id = normalizeProfile(raw);
    expect(id.name).toBe('FromName');
  });

  it('both name fields missing → falls back to email local-part', () => {
    const raw = { sub: 's1', email: 'localpart@example.com' };
    const id = normalizeProfile(raw);
    expect(id.name).toBe('localpart');
  });

  it('username field present → preserved', () => {
    const raw = { sub: 's1', email: 'u@e.com', username: 'janedoe' };
    const id = normalizeProfile(raw);
    expect(id.username).toBe('janedoe');
  });

  it('user_image field present → image set', () => {
    const raw = { sub: 's1', email: 'u@e.com', user_image: 'https://img.example.com/a.png' };
    const id = normalizeProfile(raw);
    expect(id.image).toBe('https://img.example.com/a.png');
  });

  it('roles array present → roles set', () => {
    const raw = { sub: 's1', email: 'u@e.com', roles: ['admin', 'user'] };
    const id = normalizeProfile(raw);
    expect(id.roles).toEqual(['admin', 'user']);
  });

  it('roles not array → empty array', () => {
    const raw = { sub: 's1', email: 'u@e.com', roles: 'admin' };
    const id = normalizeProfile(raw);
    expect(id.roles).toEqual([]);
  });

  it('raw is preserved', () => {
    const raw = { sub: 's1', email: 'u@e.com', extra: 'keep' };
    const id = normalizeProfile(raw);
    expect(id.raw).toBe(raw);
  });

  it('subject fallback: sub → user_id (if no sub)', () => {
    const raw = { user_id: 'uid-99', email: 'u@e.com' };
    const id = normalizeProfile(raw);
    expect(id.subject).toBe('uid-99');
  });
});
