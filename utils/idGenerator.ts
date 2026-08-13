/**
 * Cryptographically secure IDs for session identifiers and access tokens.
 * Expo's runtime provides Web Crypto on supported web/native environments.
 */
function secureBytes(length: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable on this device.');
  }
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

export const generateId = (): string => {
  const bytes = secureBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export default generateId;

export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = secureBytes(8);
  let code = '';
  for (const byte of bytes) {
    // Rejection sampling avoids modulo bias for a 32-character alphabet.
    code += chars[byte & 31];
  }
  return code;
}
