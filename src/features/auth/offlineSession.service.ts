import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import type { AuthenticatedUser } from './auth.types';

export const VERIFIED_IDENTITY_STORAGE_KEY = 'tindahan_verified_identity_v1';

function getStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVerifiedIdentity(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) return false;

  return typeof value.id === 'string'
    && typeof value.email === 'string'
    && typeof value.displayName === 'string'
    && (value.role === 'admin' || value.role === 'employee')
    && (
      value.membershipRole === 'owner'
      || value.membershipRole === 'administrator'
      || value.membershipRole === 'cashier'
      || value.membershipRole === 'staff'
    )
    && typeof value.storeId === 'string'
    && typeof value.storeName === 'string'
    && typeof value.deviceId === 'string'
    && typeof value.lastVerifiedAt === 'string';
}

export function cacheVerifiedIdentity(identity: AuthenticatedUser): void {
  getStorage()?.setItem(VERIFIED_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
}

export function getVerifiedOfflineIdentity(): AuthenticatedUser | null {
  const stored = getStorage()?.getItem(VERIFIED_IDENTITY_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isVerifiedIdentity(parsed) || parsed.deviceId !== getOrCreateDeviceId()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearVerifiedIdentity(): void {
  getStorage()?.removeItem(VERIFIED_IDENTITY_STORAGE_KEY);
}
