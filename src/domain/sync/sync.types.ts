export type SyncStatus = 'pending' | 'synced' | 'conflict';

export interface SyncMetadata {
  storeId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  baseVersion: number | null;
  updatedBy: string | null;
  deviceId: string;
  syncStatus: SyncStatus;
}

/**
 * `sync` remains optional at the type boundary so pre-v4 imports and test
 * fixtures can be read safely. Dexie v4 populates it for existing rows and
 * repositories attach it to all new records.
 */
export interface SyncableEntity {
  id: string;
  sync?: SyncMetadata;
}

export type SyncOperation = 'upsert' | 'delete' | 'transaction';
export type SyncQueueStatus = 'pending' | 'processing' | 'failed';

export interface SyncQueueItem {
  queueId?: number;
  operationId: string;
  storeId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  createdAt: string;
  attempts: number;
  status: SyncQueueStatus;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastError?: string;
}

export interface PullCursor { changedAt: string; id: string; }

export interface SyncState {
  id: string;
  storeId: string;
  pullCursor?: PullCursor;
  lastPulledAt?: string;
  lastSuccessfulSyncAt?: string;
}

export interface SyncConflict {
  id?: number;
  storeId: string;
  entityType: string;
  entityId: string;
  detectedAt: string;
  resolved: boolean;
  localPayload: unknown;
  remotePayload: unknown;
  basePayload?: unknown;
  localVersion?: number;
  serverVersion?: number;
  baseVersion?: number | null;
  localEditor?: string | null;
  remoteEditor?: string | null;
  localDevice?: string;
  remoteDevice?: string;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
  resolution?: ConflictResolution;
  resolvedAt?: string;
  resolvedBy?: string;
}
export type ConflictResolution = 'keep-local' | 'keep-cloud' | 'merge' | 'preserve-both' | 'create-adjustment';
export type InitialMigrationMode = 'create-cloud-store' | 'merge-existing-store' | 'download-cloud';
export type InitialMigrationStatus = 'prepared' | 'backed-up' | 'migrating' | 'syncing' | 'validating' | 'complete' | 'failed';
export interface MigrationBackup { id:string; createdAt:string; sourceStoreId?:string; data:Record<string,unknown[]>; counts:Record<string,number>; totals:Record<string,number>; }
export interface InitialMigrationState { id:string; mode:InitialMigrationMode; status:InitialMigrationStatus; sourceStoreId?:string; targetStoreId:string; backupId?:string; startedAt:string; updatedAt:string; processedTables:string[]; countsBefore:Record<string,number>; totalsBefore:Record<string,number>; countsAfter?:Record<string,number>; totalsAfter?:Record<string,number>; duplicateCount:number; lastError?:string; }