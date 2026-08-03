import { vaultTransactionRepo } from '@/repositories/FinancialRepository';
import type { VaultTransaction } from '@/types';

export class VaultService {
  async getBalance(): Promise<number> {
    const all = await vaultTransactionRepo.list();
    return all.reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  async getRecentTransactions(limit = 50): Promise<VaultTransaction[]> {
    return (await vaultTransactionRepo.list())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }

  async addTransaction(data: Omit<VaultTransaction, 'id' | 'date' | 'sync'>): Promise<string> {
    return vaultTransactionRepo.add({
      ...data,
      date: new Date(),
    });
  }
}

export const vaultService = new VaultService();
