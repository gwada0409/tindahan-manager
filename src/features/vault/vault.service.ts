import { db } from '@/db/database';
import { VaultTransaction } from '@/types';
import { generateId } from '@/shared/utils/id';

export class VaultService {
  async getBalance(): Promise<number> {
    const all = await db.vaultTransactions.toArray();
    return all.reduce((sum, tx) => sum + tx.amount, 0);
  }

  async getRecentTransactions(limit = 50): Promise<VaultTransaction[]> {
    return await db.vaultTransactions.orderBy('date').reverse().limit(limit).toArray();
  }

  async addTransaction(data: Omit<VaultTransaction, 'id' | 'date'>): Promise<string> {
    const id = generateId();
    await db.vaultTransactions.add({
      ...data,
      id,
      date: new Date()
    });
    return id;
  }
}

export const vaultService = new VaultService();
