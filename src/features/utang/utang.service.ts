import { utangEntryRepo } from '@/repositories/FinancialRepository';
import type { UtangEntry } from '@/types';

export class UtangService {
  async getCustomerBalances(): Promise<Record<string, number>> {
    const entries = await utangEntryRepo.list();
    const balances: Record<string, number> = {};
    entries.forEach(entry => {
      balances[entry.customerId] = (balances[entry.customerId] || 0) + entry.amount;
    });
    return balances;
  }

  async getTotalOutstanding(): Promise<number> {
    const balances = await this.getCustomerBalances();
    return Object.values(balances).reduce(
      (sum, balance) => balance > 0 ? sum + balance : sum,
      0,
    );
  }

  async getCustomerEntries(customerId: string): Promise<UtangEntry[]> {
    return (await utangEntryRepo.list())
      .filter(entry => entry.customerId === customerId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}

export const utangService = new UtangService();
