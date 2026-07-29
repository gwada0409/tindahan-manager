import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays, format, startOfDay } from 'date-fns';

import { reportsService } from '@/features/reports/reports.service';

export function Reports() {
  const data = useLiveQuery(() => reportsService.getReportsData(), []);

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Loading reports...</div>;
  }

  const { totalUtang, inventoryValue, grossRevenue7d, estProfit7d, chartData } = data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Revenue (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{(grossRevenue7d / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Profit (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${estProfit7d >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ₱{(estProfit7d / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{(inventoryValue / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Utang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">₱{(totalUtang / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>Sales Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-full pb-12">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => `₱${Number(value).toFixed(2)}`} />
              <Bar dataKey="sales" fill="#15803D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
