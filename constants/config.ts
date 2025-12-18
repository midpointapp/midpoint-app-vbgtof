
// Google Places API key (used for midpoint place search)
export const GOOGLE_PLACES_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

// Log API key status at startup
console.log('[Places] API key present:', !!GOOGLE_PLACES_API_KEY);
console.log('[Places] API key length:', GOOGLE_PLACES_API_KEY?.length || 0);

// Base URL for the web app
export const WEB_BASE_URL = 'https://web-midpoint-app-vbgtof.natively.dev';

// Default search radius in meters
export const DEFAULT_SEARCH_RADIUS = 5000;

/**
 * Generate a shareable URL for a meet point (legacy flow)
 */
export function generateShareUrl(meetPointId: string): string {
  return `${WEB_BASE_URL}/?meetPointId=${meetPointId}`;
}

/**
 * Generate a session URL with sessionId and token (new flow)
 */
export function generateSessionUrl(sessionId: string, token: string): string {
  return `${WEB_BASE_URL}/?sessionId=${sessionId}&token=${token}`;
}
