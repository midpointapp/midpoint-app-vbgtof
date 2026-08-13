// Google Places requests are proxied through the Supabase places-proxy Edge Function.
// Do not ship a Google web-service API key in the mobile/web bundle.
export const GOOGLE_PLACES_API_KEY = '';

export const WEB_BASE_URL = 'https://web-midpoint-app-vbgtof.natively.dev';
export const DEFAULT_SEARCH_RADIUS = 5000;

export function generateShareUrl(meetPointId: string): string {
  return `${WEB_BASE_URL}/?meetPointId=${meetPointId}`;
}

export function generateSessionUrl(sessionId: string, token: string): string {
  return `${WEB_BASE_URL}/?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
}
