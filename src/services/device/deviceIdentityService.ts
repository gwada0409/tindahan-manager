import { generateId } from '@/shared/utils/id';

export const DEVICE_ID_STORAGE_KEY = 'tindahan_device_id';

let memoryDeviceId: string | null = null;

function getLocalStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string {
  const storage = getLocalStorage();
  const storedDeviceId = storage?.getItem(DEVICE_ID_STORAGE_KEY);

  if (storedDeviceId) {
    memoryDeviceId = storedDeviceId;
    return storedDeviceId;
  }

  if (!memoryDeviceId) {
    memoryDeviceId = generateId();
  }

  storage?.setItem(DEVICE_ID_STORAGE_KEY, memoryDeviceId);
  return memoryDeviceId;
}

export function clearDeviceIdentityForTests(): void {
  memoryDeviceId = null;
  getLocalStorage()?.removeItem(DEVICE_ID_STORAGE_KEY);
}
