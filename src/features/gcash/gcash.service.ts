import { gcashTransactionRepo } from '@/repositories/FinancialRepository';
import { getStartOfDay } from '@/shared/utils/date';
import type { GCashTransaction } from '@/types';

export class GCashService {
  async getCurrentFloat(): Promise<number> {
    const all = await gcashTransactionRepo.list();
    return all.reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  async getFeeIncomeToday(): Promise<number> {
    const today = getStartOfDay();
    const transactions = await gcashTransactionRepo.list();
    return transactions
      .filter(transaction => transaction.date >= today)
      .reduce((sum, transaction) => sum + (transaction.serviceFee || 0), 0);
  }

  async getRecentTransactions(limit = 50): Promise<GCashTransaction[]> {
    return (await gcashTransactionRepo.list())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }

  async addTransaction(data: Omit<GCashTransaction, 'id' | 'date' | 'sync'>): Promise<string> {
    return gcashTransactionRepo.add({
      ...data,
      date: new Date(),
    });
  }
}

export const gcashService = new GCashService();
