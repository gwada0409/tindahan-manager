import { subDays, startOfDay, format } from 'date-fns';
import { dashboardService } from '@/features/dashboard/dashboard.service';
import { inventoryRepo } from '@/features/inventory/inventory.repository';
import { saleItemRepo, saleRepo } from '@/repositories/SaleRepository';

export interface DailySalesData {
  name: string;
  sales: number;
  _date: Date;
}

export interface ReportsData {
  totalUtang: number;
  inventoryValue: number;
  grossRevenue7d: number;
  estProfit7d: number;
  chartData: DailySalesData[];
}

export class ReportsService {
  async getReportsData(): Promise<ReportsData> {
    const totalUtang = await dashboardService.getTotalOutstandingUtang();
    const [products, batches] = await Promise.all([
      inventoryRepo.listProducts(),
      inventoryRepo.listBatches(),
    ]);

    let inventoryValue = 0;
    const productCostMap: Record<string, number> = {};
    products.forEach(product => {
      productCostMap[product.id] = product.costPrice;
    });
    batches.filter(batch => batch.remainingQuantity > 0).forEach(batch => {
      inventoryValue += batch.remainingQuantity * (batch.unitCost || productCostMap[batch.productId] || 0);
    });

    const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
    const recentSales = (await saleRepo.list()).filter(sale => sale.date >= sevenDaysAgo);
    const recentSaleIds = new Set(recentSales.map(sale => sale.id));
    const recentSaleItems = (await saleItemRepo.list())
      .filter(item => recentSaleIds.has(item.saleId));

    let grossRevenue7d = 0;
    let estProfit7d = 0;
    const days: Record<string, DailySalesData> = {};

    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      days[format(date, 'yyyy-MM-dd')] = {
        name: format(date, 'EEE'),
        sales: 0,
        _date: date,
      };
    }

    recentSales.forEach(sale => {
      grossRevenue7d += sale.total;
      const key = format(new Date(sale.date), 'yyyy-MM-dd');
      if (days[key]) days[key].sales += sale.total / 100;

      const saleCost = recentSaleItems
        .filter(item => item.saleId === sale.id)
        .reduce(
          (cost, item) => cost + (productCostMap[item.itemId] || 0) * item.quantity,
          0,
        );
      estProfit7d += sale.total - saleCost;
    });

    return {
      totalUtang,
      inventoryValue,
      grossRevenue7d,
      estProfit7d,
      chartData: Object.values(days),
    };
  }
}

export const reportsService = new ReportsService();
