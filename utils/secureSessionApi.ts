/**
 * Protocol-v2 session API adapter used by the staging meeting screens.
 * Production release requires two-device verification and hardened database policies.
 * Never log credentials, precise locations, or complete responses.
 */
export type MeetingCategory = 'coffee' | 'food' | 'marketplace' | 'gas' | 'park' | 'police';
export type SessionAction = 'create' | 'redeem' | 'get' | 'receiver_location' | 'find_places' | 'propose' | 'agree' | 'decline' | 'revoke';
export type SecureSessionRequest = {
  action: SessionAction;
  sessionId?: string;
  token?: string;
  code?: string;
  type?: MeetingCategory;
  lat?: number;
  lng?: number;
  placeId?: string;
  verificationToken?: string;
};
export type SecureSessionResponse = {
  protocol?: number;
  role?: 'sender' | 'receiver';
  sessionId?: string;
  senderToken?: string;
  token?: string;
  session?: Record<string, unknown>;
  places?: Array<Record<string, unknown>>;
  error?: string;
  status?: number;
};
export async function secureSessionRequest(
  request: SecureSessionRequest,
  opts: { baseUrl: string; signal?: AbortSignal }
): Promise<SecureSessionResponse> {
  const base = new URL(opts.baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid meeting service URL');
  }
  const endpoint = new URL('/functions/v1/session-api', base);
  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: opts.signal,
  });
  const result: SecureSessionResponse = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Meeting service unavailable');
  if (result.protocol !== 2) throw new Error('Unsupported meeting service version');
  return result;
}
