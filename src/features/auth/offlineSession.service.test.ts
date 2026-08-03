import { beforeEach, describe, expect, it } from 'vitest';
import { clearDeviceIdentityForTests, getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import type { AuthenticatedUser } from './auth.types';
import { cacheVerifiedIdentity, clearVerifiedIdentity, getVerifiedOfflineIdentity } from './offlineSession.service';

function identity(deviceId: string): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    role: 'admin',
    membershipRole: 'owner',
    storeId: 'store-1',
    storeName: 'Test Store',
    deviceId,
    lastVerifiedAt: '2026-07-31T00:00:00.000Z',
  };
}

describe('verified offline identity cache', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDeviceIdentityForTests();
  });

  it('restores only on the device that was verified online', () => {
    const deviceId = getOrCreateDeviceId();
    cacheVerifiedIdentity(identity(deviceId));
    expect(getVerifiedOfflineIdentity()?.email).toBe('owner@example.com');

    clearDeviceIdentityForTests();
    localStorage.setItem('tindahan_device_id', 'different-device');
    expect(getVerifiedOfflineIdentity()).toBeNull();
  });

  it('clears the verified cache without changing the device identity', () => {
    const deviceId = getOrCreateDeviceId();
    cacheVerifiedIdentity(identity(deviceId));
    clearVerifiedIdentity();
    expect(getVerifiedOfflineIdentity()).toBeNull();
    expect(getOrCreateDeviceId()).toBe(deviceId);
  });
});