import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDeviceIdentityForTests,
  DEVICE_ID_STORAGE_KEY,
  getOrCreateDeviceId,
} from './deviceIdentityService';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('deviceIdentityService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    clearDeviceIdentityForTests();
  });

  afterEach(() => {
    clearDeviceIdentityForTests();
    vi.unstubAllGlobals();
  });

  it('creates one UUID and persists it for subsequent sessions', () => {
    const first = getOrCreateDeviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(first);

    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });

  it('uses an existing persisted identifier', () => {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'existing-device-id');
    expect(getOrCreateDeviceId()).toBe('existing-device-id');
  });
});
