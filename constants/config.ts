
// Configuration file for API keys and constants
// Get your API key from: https://console.cloud.google.com/apis/credentials

export const GOOGLE_PLACES_API_KEY = 'AIzaSyBMxU0JXR2Iq1Lj0ao0Dj_5x134GuRaYd8';

// Base URL for deep links - ALWAYS use /meet-now path with query parameters
export const DOWNLOAD_LINK = 'https://web-midpoint-app-vbgtof.natively.dev';

export const DEFAULT_SEARCH_RADIUS = 10000; // meters (10km)

/**
 * Generate a share URL for a MeetPoint
 * IMPORTANT: Always use /meet-now path with query parameter
 * Format: https://web-midpoint-app-vbgtof.natively.dev/meet-now?meetPointId=<id>
 */
export const generateShareUrl = (meetPointId: string): string => {
  const url = `${DOWNLOAD_LINK}/meet-now?meetPointId=${meetPointId}`;
  console.log('[Invite] SMS link:', url);
  return url;
};
