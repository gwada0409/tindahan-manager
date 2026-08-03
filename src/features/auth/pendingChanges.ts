import { db } from '@/db/database';

interface SyncTrackedRecord {
  sync?: {
    syncStatus?: string;
  };
}

export async function countPendingLocalChanges(): Promise<number> {
  const counts = await Promise.all(db.tables.map(async (table) => {
    const rows: unknown[] = await table.toArray();
    return rows.filter((row) => (
      typeof row === 'object'
      && row !== null
      && (row as SyncTrackedRecord).sync?.syncStatus === 'pending'
    )).length;
  }));

  return counts.reduce((total, count) => total + count, 0);
}