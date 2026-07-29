import { db } from '@/db/database';
import { UtangEntry } from '@/types';

export class UtangService {
  async getCustomerBalances(): Promise<Record<string, number>> {
    // In a fully optimized system, we would store balance in the customer record
    // For now, we compute it.
    const entries = await db.utangEntries.toArray();
    const balances: Record<string, number> = {};
    entries.forEach(e => {
      balances[e.customerId] = (balances[e.customerId] || 0) + e.amount;
    });
    return balances;
  }

  async getTotalOutstanding(): Promise<number> {
    const balances = await this.getCustomerBalances();
    return Object.values(balances).reduce((sum, bal) => bal > 0 ? sum + bal : sum, 0);
  }

  async getCustomerEntries(customerId: string): Promise<UtangEntry[]> {
    return await db.utangEntries
      .where('customerId')
      .equals(customerId)
      .reverse()
      .toArray();
  }
}

export const utangService = new UtangService();
