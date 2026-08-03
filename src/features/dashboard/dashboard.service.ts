import { inventoryRepo } from '@/features/inventory/inventory.repository';
import { saleRepo } from '@/repositories/SaleRepository';
import { utangEntryRepo } from '@/repositories/FinancialRepository';
import { getStartOfDay } from '@/shared/utils/date';
import type { Sale } from '@/types';

export class DashboardService {
  async getTodaySalesTotal(): Promise<number> {
    const today = getStartOfDay();
    return (await saleRepo.list())
      .filter(sale => sale.date >= today)
      .reduce((total, sale) => total + sale.total, 0);
  }

  async getTodayTransactionsCount(): Promise<number> {
    const today = getStartOfDay();
    return (await saleRepo.list()).filter(sale => sale.date >= today).length;
  }

  async getRecentTransactions(limit = 8): Promise<Sale[]> {
    return (await saleRepo.list())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }

  async getTotalOutstandingUtang(): Promise<number> {
    const balances: Record<string, number> = {};
    (await utangEntryRepo.list()).forEach(entry => {
      balances[entry.customerId] = (balances[entry.customerId] || 0) + entry.amount;
    });
    return Object.values(balances).reduce(
      (sum, balance) => balance > 0 ? sum + balance : sum,
      0,
    );
  }

  async getOutOfStockCount(): Promise<number> {
    const [products, batches] = await Promise.all([
      inventoryRepo.listProducts(),
      inventoryRepo.listBatches(),
    ]);
    const stock: Record<string, number> = {};

    batches.forEach(batch => {
      stock[batch.productId] = (stock[batch.productId] || 0) + batch.remainingQuantity;
    });

    return products.filter(product => (stock[product.id] || 0) <= product.reorderLevel).length;
  }
}

export const dashboardService = new DashboardService();
