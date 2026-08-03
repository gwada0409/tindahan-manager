import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // Older embedded browsers may not expose Web Crypto randomUUID yet.
  return uuidv4();
}
