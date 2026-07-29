import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

import { gcashService } from '@/features/gcash/gcash.service';

export function GCash() {
  const { showToast } = useToast();
  
  const stats = useLiveQuery(async () => {
    const [currentFloat, feeIncomeToday, transactions] = await Promise.all([
      gcashService.getCurrentFloat(),
      gcashService.getFeeIncomeToday(),
      gcashService.getRecentTransactions(20)
    ]);
    return { currentFloat, feeIncomeToday, transactions };
  }, []);

  const { currentFloat = 0, feeIncomeToday = 0, transactions = [] } = stats || {};

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'cash-in' | 'cash-out' | 'increase' | 'decrease'>('cash-in');
  const [form, setForm] = useState({ amount: '', serviceFee: '', referenceNumber: '', notes: '' });

  const handleOpen = (type: 'cash-in' | 'cash-out') => {
    setModalType(type);
    setForm({ amount: '', serviceFee: '', referenceNumber: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountVal = Math.round(parseFloat(form.amount || '0') * 100);
      const finalAmount = modalType === 'cash-in' ? -amountVal : amountVal;

      await gcashService.addTransaction({
        type: modalType,
        amount: finalAmount,
        serviceFee: Math.round(parseFloat(form.serviceFee || '0') * 100),
        referenceNumber: form.referenceNumber,
        notes: form.notes
      });
      setIsModalOpen(false);
      showToast(`Successfully recorded ${modalType}!`);
    } catch (err) {
      showToast('Error recording transaction', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">GCash Ledger</h2>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => handleOpen('cash-in')}>Cash-In</Button>
          <Button onClick={() => handleOpen('cash-out')}>Cash-Out</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Float</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ₱{(currentFloat / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fee Income Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₱{(feeIncomeToday / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference No.</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{format(t.date, 'MMM d, yyyy h:mm a')}</TableCell>
                  <TableCell className="capitalize">{t.type}</TableCell>
                  <TableCell>{t.referenceNumber || '-'}</TableCell>
                  <TableCell className={`text-right font-medium ${t.amount > 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {t.amount > 0 ? '+' : ''}₱{(t.amount / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ₱{((t.serviceFee || 0) / 100).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {(!transactions || transactions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No recent GCash transactions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Record ${modalType === 'cash-in' ? 'Cash-In' : 'Cash-Out'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (₱)</label>
            <Input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Service Fee (₱)</label>
            <Input type="number" step="0.01" value={form.serviceFee} onChange={e => setForm({...form, serviceFee: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Reference Number</label>
            <Input value={form.referenceNumber} onChange={e => setForm({...form, referenceNumber: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Transaction</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
