import { db } from '@/db/database';
import { Store } from '@/types';

export class SettingsService {
  async getStoreInfo(): Promise<Store | undefined> {
    return await db.storeSettings.toCollection().first();
  }

  async updateStoreInfo(id: string, data: Partial<Store>): Promise<void> {
    await db.storeSettings.update(id, data as any);
  }

  async exportData(): Promise<Record<string, any[]>> {
    const data: Record<string, any[]> = {};
    const tableNames = db.tables.map(t => t.name);
    for (const name of tableNames) {
      data[name] = await (db as any)[name].toArray();
    }
    return data;
  }

  async importData(data: Record<string, any[]>): Promise<void> {
    await db.transaction('rw', db.tables, async () => {
      for (const [tableName, rows] of Object.entries(data)) {
        if ((db as any)[tableName] && Array.isArray(rows)) {
          await (db as any)[tableName].bulkPut(rows);
        }
      }
    });
  }

  async resetDatabase(): Promise<void> {
    await db.delete();
  }
}

export const settingsService = new SettingsService();
