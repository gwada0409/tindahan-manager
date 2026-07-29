import { db } from '@/db/database';
import { getStartOfDay } from '@/shared/utils/date';
import { Sale } from '@/types';

export class DashboardService {
  async getTodaySalesTotal(): Promise<number> {
    const today = getStartOfDay();
    const todaySales = await db.sales.where('date').aboveOrEqual(today).toArray();
    return todaySales.reduce((acc, sale) => acc + sale.total, 0);
  }

  async getTodayTransactionsCount(): Promise<number> {
    const today = getStartOfDay();
    return await db.sales.where('date').aboveOrEqual(today).count();
  }

  async getRecentTransactions(limit = 8): Promise<Sale[]> {
    return await db.sales.orderBy('date').reverse().limit(limit).toArray();
  }

  async getTotalOutstandingUtang(): Promise<number> {
    const entries = await db.utangEntries.toArray();
    const balances: Record<string, number> = {};
    entries.forEach(e => {
      balances[e.customerId] = (balances[e.customerId] || 0) + e.amount;
    });
    return Object.values(balances).reduce((sum, bal) => bal > 0 ? sum + bal : sum, 0);
  }

  async getOutOfStockCount(): Promise<number> {
    const products = await db.products.toArray();
    const batches = await db.inventoryBatches.toArray();
    
    const stock: Record<string, number> = {};
    batches.forEach(b => {
      stock[b.productId] = (stock[b.productId] || 0) + b.remainingQuantity;
    });
    
    return products.filter(p => (stock[p.id] || 0) <= p.reorderLevel).length;
  }
}

export const dashboardService = new DashboardService();
