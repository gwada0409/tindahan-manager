import { db } from '@/db/database';
import { Bill } from '@/types';
import { generateId } from '@/shared/utils/id';

export class BillsService {
  async getUpcomingBills(): Promise<Bill[]> {
    return await db.bills
      .where('status')
      .notEqual('paid')
      .sortBy('dueDate');
  }
  
  async getPaidBills(limit = 20): Promise<Bill[]> {
    const paid = await db.bills
      .where('status')
      .equals('paid')
      .toArray();
    
    // Sort by paidDate descending in memory since we don't have a compound index for status+paidDate
    return paid
      .sort((a, b) => (b.paidDate?.getTime() || 0) - (a.paidDate?.getTime() || 0))
      .slice(0, limit);
  }

  async addBill(data: Omit<Bill, 'id'>): Promise<string> {
    const id = generateId();
    await db.bills.add({ ...data, id });
    return id;
  }

  async markAsPaid(id: string): Promise<void> {
    await db.bills.update(id, { status: 'paid', paidDate: new Date() });
  }
}

export const billsService = new BillsService();
