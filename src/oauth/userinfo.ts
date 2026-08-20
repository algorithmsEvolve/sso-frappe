import { fetchWithTimeout } from '../http';
import { FrappeSSOProfileError } from '../errors';

export interface FetchUserInfoInput {
  userInfoEndpoint: string;
  accessToken: string;
  timeoutMs?: number;
}

/**
 * Fetch the OIDC userinfo endpoint with a Bearer token and return the
 * parsed JSON body. Throws {@link FrappeSSOProfileError} on non-2xx.
 */
export async function fetchUserInfo(input: FetchUserInfoInput): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithTimeout(input.userInfoEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/json',
      },
      timeoutMs: input.timeoutMs,
    });
  } catch {
    throw new FrappeSSOProfileError(
      'userinfo request failed',
      undefined,
      input.userInfoEndpoint,
    );
  }

  if (!response.ok) {
    throw new FrappeSSOProfileError(
      `userinfo request failed with status ${response.status}`,
      response.status,
      input.userInfoEndpoint,
    );
  }

  return response.json();
}
