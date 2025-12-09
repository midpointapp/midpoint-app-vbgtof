
// Configuration file for API keys and constants
// Get your API key from: https://console.cloud.google.com/apis/credentials

export const GOOGLE_PLACES_API_KEY = 'AIzaSyBMxU0JXR2Iq1Lj0ao0Dj_5x134GuRaYd8';

// Base URL for deep links - ALWAYS use /meet-session path with query parameters
export const DOWNLOAD_LINK = 'https://midpoint-app-vbgtof.natively.dev';

export const DEFAULT_SEARCH_RADIUS = 10000; // meters (10km)

/**
 * Generate a share URL for a MeetPoint
 * IMPORTANT: Always use /meet-session path with query parameter
 * Format: https://midpoint-app-vbgtof.natively.dev/meet-session?meetPointId=<id>
 */
export const generateShareUrl = (meetPointId: string): string => {
  return `${DOWNLOAD_LINK}/meet-session?meetPointId=${meetPointId}`;
};
