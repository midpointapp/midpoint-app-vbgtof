
// Base URL for the web app
export const WEB_BASE_URL = 'https://web-midpoint-app-vbgtof.natively.dev';

/**
 * Generate a shareable URL for a meet point (legacy flow)
 * @param meetPointId - The unique ID of the meet point
 * @returns The full shareable URL
 */
export function generateShareUrl(meetPointId: string): string {
  return `${WEB_BASE_URL}/?meetPointId=${meetPointId}`;
}

/**
 * Generate a session URL with sessionId and token (new flow)
 * @param sessionId - The unique ID of the session
 * @param token - The invite token for secure access
 * @returns The full session URL
 */
export function generateSessionUrl(sessionId: string, token: string): string {
  return `${WEB_BASE_URL}/?sessionId=${sessionId}&token=${token}`;
}
