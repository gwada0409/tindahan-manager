import type { Table } from 'dexie';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { nowUtcIso } from '@/shared/utils/date';

export const DEFAULT_RETRY_BASE_MS = 1_000;
export const DEFAULT_RETRY_MAX_MS = 5 * 60_000;
export const DEFAULT_PROCESSING_TIMEOUT_MS = 2 * 60_000;

export function retryDelayMs(attempts: number, baseMs = DEFAULT_RETRY_BASE_MS, maxMs = DEFAULT_RETRY_MAX_MS): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));
}

export class SyncQueueService {
  private readonly table: Table<SyncQueueItem, number>;

  constructor(table: Table<SyncQueueItem, number>) {
    this.table = table;
  }

  async listReady(now = new Date()): Promise<SyncQueueItem[]> {
    const nowMs = now.getTime();
    const [pending, failed] = await Promise.all([
      this.table.where('status').equals('pending').toArray(),
      this.table.where('status').equals('failed').toArray(),
    ]);
    return [...pending, ...failed.filter((item) => !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= nowMs)];
  }

  async markProcessing(queueId: number, now = new Date()): Promise<void> {
    const item = await this.table.get(queueId);
    if (!item) throw new Error(`Missing sync queue item: ${queueId}`);
    await this.table.update(queueId, {
      status: 'processing',
      attempts: item.attempts + 1,
      lastAttemptAt: nowUtcIso(() => now),
      nextAttemptAt: undefined,
      lastError: undefined,
    });
  }

  async markFailed(queueId: number, error: unknown, now = new Date()): Promise<void> {
    const item = await this.table.get(queueId);
    if (!item) throw new Error(`Missing sync queue item: ${queueId}`);
    const delay = retryDelayMs(item.attempts);
    await this.table.update(queueId, {
      status: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
    });
  }

  async recoverStuckProcessing(now = new Date(), timeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS): Promise<number> {
    const cutoff = now.getTime() - timeoutMs;
    const stuck = (await this.table.where('status').equals('processing').toArray())
      .filter((item) => !item.lastAttemptAt || Date.parse(item.lastAttemptAt) <= cutoff);
    await this.table.bulkUpdate(stuck.flatMap((item) => item.queueId === undefined ? [] : [{ key: item.queueId, changes: { status: 'pending', nextAttemptAt: undefined, lastError: 'Recovered after interrupted synchronization.' } }]));
    return stuck.length;
  }

  async acknowledge(queueId: number): Promise<void> {
    await this.table.delete(queueId);
  }
}