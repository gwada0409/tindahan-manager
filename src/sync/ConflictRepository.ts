import { db, type TindahanDB } from '@/db/database';
import type { ConflictResolution, SyncConflict, SyncMetadata } from '@/domain/sync/sync.types';

const mutableTables: Record<string, string> = {
  product_categories: 'categories', suppliers: 'suppliers', products: 'products', customers: 'customers',
  bills: 'bills', employees: 'employees', inventory_batches: 'inventoryBatches',
};
const protectedEntities = new Set(['sale_transaction','sale_compensation','sales','stock_movements','inventory_movement','utang_entries','gcash_transactions','payroll_entries','vault_transactions']);

export class ConflictRepository {
  private readonly database: TindahanDB;
  constructor(database: TindahanDB = db) { this.database = database; }

  async record(conflict: Omit<SyncConflict, 'id' | 'resolved'>): Promise<number> {
    const existing = await this.database.syncConflicts.where('storeId').equals(conflict.storeId).filter((item) => !item.resolved && item.entityType === conflict.entityType && item.entityId === conflict.entityId).first();
    if (existing?.id !== undefined) { await this.database.syncConflicts.update(existing.id, conflict); return existing.id; }
    return this.database.syncConflicts.add({ ...conflict, resolved: false });
  }

  async resolve(id: number, resolution: ConflictResolution, actorId: string, mergedPayload?: unknown): Promise<void> {
    const conflict = await this.database.syncConflicts.get(id);
    if (!conflict || conflict.resolved) throw new Error('Conflict is no longer available.');
    if (protectedEntities.has(conflict.entityType)) throw new Error('Ledger and financial records cannot be overwritten. Create the correction in its source module so a compensating entry is recorded.');
    const tableName = mutableTables[conflict.entityType];
    if (!tableName) throw new Error('This entity requires a module-specific resolution.');
    if (!['keep-local','keep-cloud','merge'].includes(resolution)) throw new Error('This resolution is not valid for the selected record.');
    const entityTable = this.database.table(tableName);
    const payload = resolution === 'keep-cloud' ? conflict.remotePayload : resolution === 'merge' ? mergedPayload : conflict.localPayload;
    if (!payload || typeof payload !== 'object') throw new Error('A valid merged record is required.');
    const now = new Date().toISOString();
    await this.database.transaction('rw', [entityTable, this.database.syncQueue, this.database.syncConflicts, this.database.auditLogs], async () => {
      if (resolution === 'keep-cloud') {
        await entityTable.put(payload);
        await this.database.syncQueue.where('entityId').equals(conflict.entityId).delete();
      } else {
        const value = structuredClone(payload) as Record<string, unknown>;
        const previous = (value.sync ?? {}) as Partial<SyncMetadata>;
        const sync: SyncMetadata = { storeId: conflict.storeId, createdAt: previous.createdAt ?? now, updatedAt: now, deletedAt: previous.deletedAt ?? null, version: (conflict.serverVersion ?? previous.version ?? 0) + 1, baseVersion: conflict.serverVersion ?? null, updatedBy: actorId, deviceId: previous.deviceId ?? 'unknown-device', syncStatus: 'pending' };
        value.sync = sync;
        await entityTable.put(value);
        const queued = await this.database.syncQueue.where('entityId').equals(conflict.entityId).toArray();
        for (const item of queued) if (item.queueId !== undefined) await this.database.syncQueue.update(item.queueId, { payload: value, status: 'pending', attempts: 0, nextAttemptAt: undefined, lastError: undefined });
      }
      await this.database.syncConflicts.update(id, { resolved: true, resolution, resolvedAt: now, resolvedBy: actorId });
      await this.database.auditLogs.add({ id: crypto.randomUUID(), date: new Date(now), action: 'resolve_sync_conflict', entityType: conflict.entityType, entityId: conflict.entityId, details: JSON.stringify({ conflictId: id, resolution, localVersion: conflict.localVersion, serverVersion: conflict.serverVersion }) });
    });
  }
}

export const conflictRepository = new ConflictRepository();