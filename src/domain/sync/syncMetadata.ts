import type { SyncMetadata, SyncStatus } from './sync.types';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import { nowUtcIso, toUtcIso } from '@/shared/utils/date';

export const UNASSIGNED_LOCAL_STORE_ID = 'local-store-unassigned';

export interface SyncMetadataOptions {
  storeId: string;
  deviceId?: string;
  createdAt?: Date | string | number;
  updatedAt?: Date | string | number;
  updatedBy?: string | null;
  syncStatus?: SyncStatus;
}

export function createSyncMetadata(options: SyncMetadataOptions): SyncMetadata {
  const fallbackNow = nowUtcIso();
  const createdAt = toUtcIso(options.createdAt, fallbackNow);

  return {
    storeId: options.storeId,
    createdAt,
    updatedAt: toUtcIso(options.updatedAt, createdAt),
    deletedAt: null,
    version: 1,
    baseVersion: null,
    updatedBy: options.updatedBy ?? null,
    deviceId: options.deviceId ?? getOrCreateDeviceId(),
    syncStatus: options.syncStatus ?? 'pending',
  };
}

export function touchSyncMetadata(
  current: SyncMetadata,
  options: {
    deviceId?: string;
    updatedAt?: Date | string | number;
    updatedBy?: string | null;
    deletedAt?: string | null;
  } = {}
): SyncMetadata {
  return {
    ...current,
    updatedAt: toUtcIso(options.updatedAt),
    deletedAt: options.deletedAt === undefined ? current.deletedAt : options.deletedAt,
    version: current.version + 1,
    baseVersion: current.version,
    updatedBy: options.updatedBy === undefined ? current.updatedBy : options.updatedBy,
    deviceId: options.deviceId ?? getOrCreateDeviceId(),
    syncStatus: 'pending',
  };
}

export function isSoftDeleted(entity: { sync?: SyncMetadata }): boolean {
  return Boolean(entity.sync?.deletedAt);
}
