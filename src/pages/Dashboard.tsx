import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { inventoryRepo } from '@/features/inventory/inventory.repository';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { stockService } from '@/features/inventory/stock.service';
import { dashboardService } from '@/features/dashboard/dashboard.service';
import { StockIndicator } from '@/features/inventory/components/StockIndicator';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Product, StockStatus } from '@/types';

export function Dashboard() {
  const stats = useLiveQuery(async () => {
    const [salesTotalToday, transactionsToday, totalUtang, recentTransactions, products, batches] = await Promise.all([
      dashboardService.getTodaySalesTotal(),
      dashboardService.getTodayTransactionsCount(),
      dashboardService.getTotalOutstandingUtang(),
      dashboardService.getRecentTransactions(8),
      inventoryRepo.listProducts(),
      inventoryRepo.listBatches()
    ]);

    // Calculate real stock metrics & restock list
    let outOfStockCount = 0;
    let criticalCount = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    const now = new Date().getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    const restockItems: Array<{ product: Product; summary: ReturnType<typeof stockService.calculateProductStockSummary> }> = [];

    for (const product of products) {
      const summary = stockService.calculateProductStockSummary(product, batches);
      if (summary.status === 'out-of-stock') outOfStockCount++;
      else if (summary.status === 'critical') criticalCount++;
      else if (summary.status === 'low-stock') lowStockCount++;

      if (summary.nextExpirationDate) {
        const diff = summary.nextExpirationDate.getTime() - now;
        if (diff > 0 && diff <= thirtyDays) expiringSoonCount++;
      }

      if (summary.status !== 'in-stock') {
        restockItems.push({ product, summary });
      }
    }

    // Sort restock items by priority: 1. out-of-stock, 2. critical, 3. low-stock, 4. lowest quantity
    restockItems.sort((a, b) => {
      const priority = (s: StockStatus) => {
        if (s === 'out-of-stock') return 1;
        if (s === 'critical') return 2;
        if (s === 'low-stock') return 3;
        return 4;
      };
      const pA = priority(a.summary.status);
      const pB = priority(b.summary.status);
      if (pA !== pB) return pA - pB;
      return a.summary.sellableQuantity - b.summary.sellableQuantity;
    });

    return {
      salesTotalToday,
      transactionsToday,
      totalUtang,
      recentTransactions,
      outOfStockCount,
      criticalCount,
      lowStockCount,
      expiringSoonCount,
      restockList: restockItems.slice(0, 5)
    };
  }, []);

  const {
    salesTotalToday = 0,
    transactionsToday = 0,
    totalUtang = 0,
    recentTransactions = [],
    outOfStockCount = 0,
    criticalCount = 0,
    lowStockCount = 0,
    expiringSoonCount = 0,
    restockList = []
  } = stats || {};

  return (
    <div className="space-y-6">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary tabular-nums">₱{(salesTotalToday / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{transactionsToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${outOfStockCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {outOfStockCount + criticalCount + lowStockCount}
              </span>
              <span className="text-xs text-muted-foreground">
                ({outOfStockCount} out, {criticalCount} critical, {lowStockCount} low)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Utang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive tabular-nums">₱{(totalUtang / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Restock List + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Restock Prioritized List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Prioritized Restock List
            </CardTitle>
            <Link to="/inventory" className="text-xs font-medium text-primary hover:underline inline-flex items-center">
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {restockList.length > 0 ? (
              <div className="space-y-3">
                {restockList.map(({ product, summary }) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <div>
                      <div className="font-semibold text-sm">{product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">SKU: {product.sku}</div>
                    </div>
                    <StockIndicator
                      quantity={summary.sellableQuantity}
                      reorderLevel={summary.reorderLevel}
                      status={summary.status}
                      unit={product.unit}
                      compact
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-12">
                All products have healthy stock levels!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Recent Sales</CardTitle>
            <Link to="/sales" className="text-xs font-medium text-primary hover:underline inline-flex items-center">
              POS <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.date), 'h:mm a')}</TableCell>
                      <TableCell className="capitalize">{sale.paymentMethod}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">₱{(sale.total / 100).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-12">No recent transactions</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
