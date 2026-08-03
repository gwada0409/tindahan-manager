import type { PullCursor, SyncQueueItem } from '@/domain/sync/sync.types';

export interface LocalSyncContext { storeId: string; userId: string; deviceId: string; onlineSession: boolean; }
export interface PushResult { operationId: string; status: 'processed' | 'failed'; duplicate?: boolean; errorCode?: string; error?: string; }
export interface PushSummary { attempted: number; processed: number; failed: number; skippedReason?: string; }
export type PullEntityType = 'product_categories' | 'suppliers' | 'products' | 'customers' | 'inventory_batches' | 'stock_movements' | 'utang_entries' | 'gcash_transactions' | 'bills' | 'employees' | 'payroll_entries' | 'vault_transactions';
export interface PullChange { entityType: PullEntityType; changedAt: string; record: Record<string, unknown>; }
export interface PullPage { changes: PullChange[]; nextCursor: PullCursor; hasMore: boolean; }
export interface SyncSummary extends PushSummary { pulled: number; }
export interface SyncAdapter {
  verifySession(): Promise<boolean>;
  isReachable(storeId: string, timeoutMs?: number): Promise<boolean>;
  push(operations: SyncQueueItem[]): Promise<PushResult[]>;
  pull(storeId: string, cursor: PullCursor, limit: number): Promise<PullPage>;
  recordDeviceSync?(storeId: string, deviceId: string): Promise<void>;
  cleanupReceipts?(storeId: string): Promise<number>;
}
export type SyncRunReason = 'app-start' | 'sign-in' | 'online' | 'interval' | 'mutation' | 'manual' | 'realtime';
export type SyncActivity = 'idle' | 'syncing' | 'offline' | 'error' | 'success';
export interface SyncStatusSnapshot { activity: SyncActivity; pending: number; lastResult?: SyncSummary; message?: string; lastConnectivityCheckAt?: string; lastPushAt?: string; lastPullAt?: string; lastSuccessfulSyncAt?: string; }