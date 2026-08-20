import type { FrappeProviderMetadata } from '../types';
import { FrappeSSODiscoveryError } from '../errors';
import { fetchWithTimeout } from '../http';

export interface FrappeProviderInput {
  baseUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  discoveryEndpoint?: string;
  timeoutMs?: number;
}

export interface FrappeProviderEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string | undefined;
  metadata?: FrappeProviderMetadata;
}

/**
 * Build a `frappeProvider` config object from a base URL + optional overrides.
 * This does not perform any network calls — it just collects the input.
 */
export function frappeProvider(input: {
  baseUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  discoveryEndpoint?: string;
}): FrappeProviderInput {
  return { ...input };
}

/**
 * Resolve the final OAuth/OIDC endpoints.
 *
 * Resolution order per endpoint:
 * 1. Explicit override from the consumer.
 * 2. Discovery metadata from `/.well-known/openid-configuration`.
 *
 * If both authorization and token endpoints are explicitly provided,
 * no network call is made at all.
 */
export async function resolveProviderEndpoints(
  input: FrappeProviderInput,
): Promise<FrappeProviderEndpoints> {
  const { discoveryEndpoint, timeoutMs } = input;

  // Fast path: both required endpoints are explicitly provided.
  if (input.authorizationEndpoint && input.tokenEndpoint) {
    return {
      authorizationEndpoint: input.authorizationEndpoint,
      tokenEndpoint: input.tokenEndpoint,
      userInfoEndpoint: input.userInfoEndpoint,
    };
  }

  // Need discovery to fill in missing endpoints.
  if (!discoveryEndpoint) {
    throw new FrappeSSODiscoveryError(
      'Cannot resolve endpoints: discoveryEndpoint is required when authorizationEndpoint or tokenEndpoint is not provided',
    );
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(discoveryEndpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      timeoutMs,
    });
  } catch (cause) {
    throw new FrappeSSODiscoveryError(
      'Failed to fetch OIDC discovery metadata',
      undefined,
      discoveryEndpoint,
    );
  }

  if (!response.ok) {
    throw new FrappeSSODiscoveryError(
      `Discovery request failed with HTTP ${response.status}`,
      response.status,
      discoveryEndpoint,
    );
  }

  let metadata: FrappeProviderMetadata;
  try {
    metadata = (await response.json()) as FrappeProviderMetadata;
  } catch {
    throw new FrappeSSODiscoveryError(
      'Discovery response is not valid JSON',
      response.status,
      discoveryEndpoint,
    );
  }

  // Overrides win over discovery.
  const authorizationEndpoint =
    input.authorizationEndpoint ?? metadata.authorization_endpoint;
  const tokenEndpoint = input.tokenEndpoint ?? metadata.token_endpoint;
  const userInfoEndpoint =
    input.userInfoEndpoint ?? metadata.userinfo_endpoint;

  if (!authorizationEndpoint) {
    throw new FrappeSSODiscoveryError(
      'Discovery metadata is missing authorization_endpoint and no override was provided',
      undefined,
      discoveryEndpoint,
    );
  }

  if (!tokenEndpoint) {
    throw new FrappeSSODiscoveryError(
      'Discovery metadata is missing token_endpoint and no override was provided',
      undefined,
      discoveryEndpoint,
    );
  }

  return {
    authorizationEndpoint,
    tokenEndpoint,
    userInfoEndpoint,
    metadata,
  };
}
