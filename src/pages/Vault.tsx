import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { vaultService } from '@/features/vault/vault.service';
import { format } from 'date-fns';

export function Vault() {
  const stats = useLiveQuery(async () => {
    const [balance, transactions] = await Promise.all([
      vaultService.getBalance(),
      vaultService.getRecentTransactions(20)
    ]);
    return { balance, transactions };
  }, []);

  const { balance = 0, transactions = [] } = stats || {};

  const { showToast } = useToast();
  
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleTransaction = async (type: 'deposit' | 'withdrawal') => {
    try {
      const numAmount = Number(amount) * 100;
      const finalAmount = type === 'deposit' ? numAmount : -numAmount;
      
      await vaultService.addTransaction({
        type,
        amount: finalAmount,
        notes
      });
      
      showToast(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!`);
      setAmount('');
      setNotes('');
      if (type === 'deposit') setIsDepositModalOpen(false);
      else setIsWithdrawModalOpen(false);
    } catch (error) {
      showToast('Transaction failed', 'error');
    }
  };

  const openDepositModal = () => {
    setAmount('');
    setNotes('');
    setIsDepositModalOpen(true);
  };

  const openWithdrawModal = () => {
    setAmount('');
    setNotes('');
    setIsWithdrawModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Cash Vault</h2>
        <div className="space-x-2">
          <Button variant="outline" onClick={openWithdrawModal}>Withdraw</Button>
          <Button onClick={openDepositModal}>Deposit</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vault Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
              ₱{(balance / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(new Date(tx.date), 'MMM d, yyyy h:mm a')}</TableCell>
                  <TableCell className="capitalize">{tx.type}</TableCell>
                  <TableCell>{tx.notes}</TableCell>
                  <TableCell className={`text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}₱{(tx.amount / 100).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal isOpen={isDepositModalOpen} onClose={() => setIsDepositModalOpen(false)} title="Deposit to Vault">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (₱)</label>
            <Input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsDepositModalOpen(false)}>Cancel</Button>
            <Button onClick={() => handleTransaction('deposit')} disabled={!amount}>Confirm Deposit</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Withdraw from Vault">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (₱)</label>
            <Input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>Cancel</Button>
            <Button onClick={() => handleTransaction('withdrawal')} disabled={!amount} variant="destructive">Confirm Withdraw</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
