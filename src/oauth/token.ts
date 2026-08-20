import type { FrappeToken } from '../types';
import { FrappeSSOTokenError } from '../errors';
import { fetchWithTimeout } from '../http';

export interface ExchangeCodeInput {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
  timeoutMs?: number;
}

export async function exchangeCode(input: ExchangeCodeInput): Promise<FrappeToken> {
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', input.code);
  params.set('redirect_uri', input.redirectUri);
  params.set('client_id', input.clientId);
  params.set('client_secret', input.clientSecret);
  if (input.codeVerifier) {
    params.set('code_verifier', input.codeVerifier);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(input.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      timeoutMs: input.timeoutMs,
    });
  } catch (err) {
    throw new FrappeSSOTokenError(
      'Token exchange request failed',
      undefined,
      input.tokenEndpoint,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorDetail = extractError(body);
    throw new FrappeSSOTokenError(
      errorDetail
        ? `Token exchange failed: ${errorDetail}`
        : `Token exchange failed`,
      response.status,
      input.tokenEndpoint,
    );
  }

  const data = body as Record<string, unknown>;
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new FrappeSSOTokenError(
      'Token response missing access_token',
      response.status,
      input.tokenEndpoint,
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    idToken: typeof data.id_token === 'string' ? data.id_token : undefined,
    raw: body,
  };
}

function extractError(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.error_description === 'string') return obj.error_description;
  if (typeof obj.error === 'string') return obj.error;
  return undefined;
}
