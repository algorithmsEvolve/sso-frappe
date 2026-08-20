export interface AuthorizationUrlInput {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: readonly string[];
  state: string;
  usePkce: boolean;
  codeChallenge?: string;
}

export interface AuthorizationUrlResult {
  url: string;
}

/**
 * Build the OAuth2 authorization URL with all required parameters.
 *
 * Never includes `client_secret` — the authorization URL is visited
 * in the browser and must not carry secrets.
 */
export function buildAuthorizationUrl(
  input: AuthorizationUrlInput,
): AuthorizationUrlResult {
  const url = new URL(input.authorizationEndpoint);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', input.scope.join(' '));
  url.searchParams.set('state', input.state);

  if (input.usePkce && input.codeChallenge) {
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return { url: url.toString() };
}
