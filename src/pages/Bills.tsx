import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

import { billsService } from '@/features/bills/bills.service';

export function Bills() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmingBillId, setConfirmingBillId] = useState<string | null>(null);
  const [confirmingBillName, setConfirmingBillName] = useState<string | null>(null);
  const { showToast } = useToast();

  const data = useLiveQuery(async () => {
    const [upcomingBills, paidBills] = await Promise.all([
      billsService.getUpcomingBills(),
      billsService.getPaidBills(20)
    ]);
    return { upcomingBills, paidBills };
  }, []);

  const { upcomingBills = [], paidBills = [] } = data || {};

  const handleAddBill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await billsService.addBill({
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      provider: formData.get('provider') as string,
      amount: Math.round(parseFloat(formData.get('amount') as string) * 100),
      dueDate: new Date(formData.get('dueDate') as string),
      recurrence: formData.get('recurrence') as any,
      status: 'upcoming',
      notes: formData.get('notes') as string,
    });

    setIsAddModalOpen(false);
    showToast('Bill added successfully!');
  };

  const handlePayClick = (id: string, name: string) => {
    setConfirmingBillId(id);
    setConfirmingBillName(name);
  };

  const handlePayConfirm = async () => {
    if (confirmingBillId) {
      await billsService.markAsPaid(confirmingBillId);
      showToast(`${confirmingBillName} marked as paid!`);
      setConfirmingBillId(null);
      setConfirmingBillName(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Bills & Expenses</h2>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Bill
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming & Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBills.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No upcoming bills.</p>
            ) : (
              <div className="space-y-4">
                {upcomingBills.map(bill => (
                  <div key={bill.id} className="flex justify-between items-center p-3 border rounded-lg bg-white">
                    <div>
                      <div className="font-semibold">{bill.name}</div>
                      <div className="text-sm text-muted-foreground">Due: {format(bill.dueDate, 'MMM d, yyyy')}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-bold text-destructive">₱{(bill.amount / 100).toFixed(2)}</div>
                      <Button size="sm" onClick={() => handlePayClick(bill.id, bill.name)}>Pay</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {paidBills.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent payments.</p>
            ) : (
              <div className="space-y-4">
                {paidBills.map(bill => (
                  <div key={bill.id} className="flex justify-between items-center p-3 border rounded-lg bg-muted/50 opacity-70">
                    <div>
                      <div className="font-semibold">{bill.name}</div>
                      <div className="text-sm text-muted-foreground">Paid: {bill.paidDate ? format(bill.paidDate, 'MMM d, yyyy') : 'Unknown'}</div>
                    </div>
                    <div className="font-bold">₱{(bill.amount / 100).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Bill">
        <form onSubmit={handleAddBill} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bill Name</label>
            <Input name="name" required placeholder="e.g. Meralco" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select name="category" className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="electricity">Electricity</option>
                <option value="water">Water</option>
                <option value="rent">Rent</option>
                <option value="internet">Internet</option>
                <option value="loan">Loan</option>
                <option value="tax">Tax</option>
                <option value="supplies">Supplies</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Input name="provider" placeholder="e.g. Manila Water" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (₱)</label>
              <Input name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input name="dueDate" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Recurrence</label>
            <select name="recurrence" className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="none">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input name="notes" placeholder="Optional notes" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Bill</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmingBillId}
        onClose={() => { setConfirmingBillId(null); setConfirmingBillName(null); }}
        onConfirm={handlePayConfirm}
        title="Confirm Payment"
        description={`Are you sure you want to mark ${confirmingBillName} as paid?`}
      />
    </div>
  );
}
