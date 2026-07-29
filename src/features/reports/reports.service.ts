import { db } from '@/db/database';
import { subDays, startOfDay, format } from 'date-fns';
import { dashboardService } from '@/features/dashboard/dashboard.service';

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
    
    // Inventory Value
    let inventoryValue = 0;
    const products = await db.products.toArray();
    const productCostMap: Record<string, number> = {};
    products.forEach(p => productCostMap[p.id] = p.costPrice);

    // Only get active batches for value computation
    const activeBatches = await db.inventoryBatches.filter(b => b.remainingQuantity > 0).toArray();
    activeBatches.forEach(b => {
      inventoryValue += b.remainingQuantity * (b.unitCost || productCostMap[b.productId] || 0);
    });

    // 7-day Sales & Profit
    const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
    const recentSales = await db.sales.where('date').aboveOrEqual(sevenDaysAgo).toArray();
    
    const saleIds = recentSales.map(s => s.id);
    // Since saleIds can be large, we might need a workaround or just fetch all saleItems and filter in memory if Dexie lacks where(in)
    // Dexie supports anyOf, which translates to SQL IN clause equivalent.
    const recentSaleItems = await db.saleItems.where('saleId').anyOf(saleIds).toArray();

    let grossRevenue7d = 0;
    let estProfit7d = 0;
    
    // Initialize chart data
    const days: Record<string, DailySalesData> = {};
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const key = format(d, 'yyyy-MM-dd');
      days[key] = {
        name: format(d, 'EEE'),
        sales: 0,
        _date: d
      };
    }

    recentSales.forEach(sale => {
      grossRevenue7d += sale.total;
      
      const key = format(new Date(sale.date), 'yyyy-MM-dd');
      if (days[key]) {
        days[key].sales += (sale.total / 100);
      }

      // Calculate profit
      const items = recentSaleItems.filter(item => item.saleId === sale.id);
      let saleCost = 0;
      items.forEach(item => {
        const cost = productCostMap[item.itemId] || 0;
        saleCost += cost * item.quantity;
      });
      estProfit7d += (sale.total - saleCost);
    });

    return {
      totalUtang,
      inventoryValue,
      grossRevenue7d,
      estProfit7d,
      chartData: Object.values(days)
    };
  }
}

export const reportsService = new ReportsService();
