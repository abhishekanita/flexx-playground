
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

export function sanitizeUrl(url: string): string {
  return url.replace(/\s+/g, '%20')
}

/**
 * Generate a unique ID for resources
 * @returns A unique string ID
 */
export function generateId(length: number = 10): string {
  return nanoid(length);
}
