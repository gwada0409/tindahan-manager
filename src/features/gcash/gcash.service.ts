import { db } from '@/db/database';
import { getStartOfDay } from '@/shared/utils/date';
import { GCashTransaction } from '@/types';
import { generateId } from '@/shared/utils/id';

export class GCashService {
  async getCurrentFloat(): Promise<number> {
    // In a fully optimized app, we'd track float in a single settings/balances record
    const all = await db.gcashTransactions.toArray();
    return all.reduce((sum, t) => sum + t.amount, 0);
  }

  async getFeeIncomeToday(): Promise<number> {
    const today = getStartOfDay();
    const todayTrans = await db.gcashTransactions.where('date').aboveOrEqual(today).toArray();
    return todayTrans.reduce((sum, t) => sum + (t.serviceFee || 0), 0);
  }

  async getRecentTransactions(limit = 50): Promise<GCashTransaction[]> {
    return await db.gcashTransactions.orderBy('date').reverse().limit(limit).toArray();
  }

  async addTransaction(data: Omit<GCashTransaction, 'id' | 'date'>): Promise<string> {
    const id = generateId();
    await db.gcashTransactions.add({
      ...data,
      id,
      date: new Date()
    });
    return id;
  }
}

export const gcashService = new GCashService();
