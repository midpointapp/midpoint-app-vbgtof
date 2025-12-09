
/**
 * Safari-safe ID generator using ONLY Math.random()
 * This ensures compatibility across all browsers, webviews, and native apps
 * without relying on crypto.randomUUID() or crypto.getRandomValues()
 */
export const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default generateId;
