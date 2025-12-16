
// Configuration file for API keys and constants
// Get your API key from: https://console.cloud.google.com/apis/credentials

export const GOOGLE_PLACES_API_KEY = 'AIzaSyBMxU0JXR2Iq1Lj0ao0Dj_5x134GuRaYd8';

// Base URL for deep links - ALWAYS use root path with query parameters
export const DOWNLOAD_LINK = 'https://web-midpoint-app-vbgtof.natively.dev';

export const DEFAULT_SEARCH_RADIUS = 10000; // meters (10km)

/**
 * Generate a share URL for a MeetPoint
 * IMPORTANT: Use ROOT path (/) with query parameter to avoid 404 on web
 * The home screen will auto-route to /meet-now internally
 * Format: https://web-midpoint-app-vbgtof.natively.dev/?meetPointId=<id>
 */
export const generateShareUrl = (meetPointId: string): string => {
  const url = `${DOWNLOAD_LINK}/?meetPointId=${meetPointId}`;
  console.log('[Invite] SMS link (root path):', url);
  return url;
};

/**
 * Generate a session URL for the new session flow
 * Format: https://web-midpoint-app-vbgtof.natively.dev/?sessionId=<id>
 */
export const generateSessionUrl = (sessionId: string): string => {
  const url = `${DOWNLOAD_LINK}/?sessionId=${sessionId}`;
  console.log('[Session] SMS link (root path):', url);
  return url;
};
