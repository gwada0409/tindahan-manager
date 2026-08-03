import { billRepo } from '@/repositories/FinancialRepository';
import type { Bill } from '@/types';

export class BillsService {
  async getUpcomingBills(): Promise<Bill[]> {
    return (await billRepo.list())
      .filter(bill => bill.status !== 'paid')
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  async getPaidBills(limit = 20): Promise<Bill[]> {
    return (await billRepo.list())
      .filter(bill => bill.status === 'paid')
      .sort((a, b) => (b.paidDate?.getTime() || 0) - (a.paidDate?.getTime() || 0))
      .slice(0, limit);
  }

  async addBill(data: Omit<Bill, 'id' | 'sync'>): Promise<string> {
    return billRepo.add(data);
  }

  async markAsPaid(id: string): Promise<void> {
    await billRepo.update(id, { status: 'paid', paidDate: new Date() });
  }
}

export const billsService = new BillsService();
