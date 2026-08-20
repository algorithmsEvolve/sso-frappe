import type { FrappeIdentity } from './types';
import { FrappeSSOProfileError } from './errors';

/**
 * Normalize a raw Frappe userinfo / openid_profile response into
 * a {@link FrappeIdentity}. Pure function — no network access.
 */
export function normalizeProfile(raw: unknown): FrappeIdentity {
  if (typeof raw !== 'object' || raw === null) {
    throw new FrappeSSOProfileError('userinfo response must be a JSON object');
  }
  const r = raw as Record<string, unknown>;

  // --- email (required) ---
  const emailRaw = typeof r.email === 'string' ? r.email : '';
  const email = emailRaw.trim().toLowerCase();
  if (email.length === 0) {
    throw new FrappeSSOProfileError('userinfo response is missing a valid email');
  }

  // --- subject: sub → user_id fallback ---
  const sub = typeof r.sub === 'string' ? r.sub : '';
  const userId = typeof r.user_id === 'string' ? r.user_id : '';
  const subject = sub || userId;
  if (subject.length === 0) {
    throw new FrappeSSOProfileError('userinfo response is missing a subject (sub or user_id)');
  }

  // --- display name: full_name → name → email local-part ---
  const fullName = typeof r.full_name === 'string' ? r.full_name : '';
  const nameField = typeof r.name === 'string' ? r.name : '';
  const name = fullName || nameField || email.split('@')[0];

  // --- optional fields ---
  const username =
    typeof r.username === 'string' && r.username.length > 0 ? r.username : null;
  const image =
    typeof r.user_image === 'string' && r.user_image.length > 0
      ? r.user_image
      : null;

  // --- roles (defensive: only accept arrays of strings) ---
  let roles: string[] = [];
  if (Array.isArray(r.roles)) {
    for (let i = 0; i < r.roles.length; i++) {
      const item = r.roles[i];
      if (typeof item === 'string') roles.push(item);
    }
  }

  return { subject, email, name, username, image, roles, raw };
}
