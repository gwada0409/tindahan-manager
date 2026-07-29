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

import { utangService } from '@/features/utang/utang.service';

export function Utang() {
  const { showToast } = useToast();
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  
  // Use service for balances instead of full table pull in UI
  const balances = useLiveQuery(() => utangService.getCustomerBalances(), []) || {};
  const totalOutstanding = Object.values(balances).reduce((acc, val) => val > 0 ? acc + val : acc, 0);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', phoneNumber: '', address: '', creditLimit: '', notes: '' });
  
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [isViewOpen, setIsViewOpen] = useState(false);

  // Fetch only the selected customer's entries using indexed query
  const customerEntries = useLiveQuery(
    () => selectedCustomer ? utangService.getCustomerEntries(selectedCustomer.id) : [],
    [selectedCustomer?.id]
  ) || [];

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.customers.add({
        id: uuidv4(),
        fullName: addForm.fullName,
        phoneNumber: addForm.phoneNumber,
        address: addForm.address,
        creditLimit: Math.round(parseFloat(addForm.creditLimit || '0') * 100),
        notes: addForm.notes,
        active: true,
        createdAt: new Date(),
      });
      setIsAddOpen(false);
      setAddForm({ fullName: '', phoneNumber: '', address: '', creditLimit: '', notes: '' });
      showToast('Customer added successfully!');
    } catch (err) {
      showToast('Error adding customer', 'error');
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await db.utangEntries.add({
        id: uuidv4(),
        customerId: selectedCustomer.id,
        date: new Date(),
        type: 'payment',
        amount: Math.round(parseFloat(payAmount || '0') * -100),
        notes: '',
      });
      setIsPayOpen(false);
      setPayAmount('');
      showToast('Payment recorded!');
    } catch (err) {
      showToast('Error recording payment', 'error');
    }
  };

  const openPay = (c: any) => {
    setSelectedCustomer(c);
    setIsPayOpen(true);
  };

  const openView = (c: any) => {
    setSelectedCustomer(c);
    setIsViewOpen(true);
  };

  // Derived state handled by useLiveQuery above

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Utang Ledger</h2>
        <Button onClick={() => setIsAddOpen(true)}>Add Customer</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ₱{(totalOutstanding / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.fullName}</TableCell>
                  <TableCell>{customer.phoneNumber}</TableCell>
                  <TableCell>₱{(customer.creditLimit / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-destructive font-bold">
                    ₱{((balances[customer.id] || 0) / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => openPay(customer)}>Pay</Button>
                    <Button variant="secondary" size="sm" onClick={() => openView(customer)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!customers || customers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Customer">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <Input required value={addForm.fullName} onChange={e => setAddForm({...addForm, fullName: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Phone Number</label>
            <Input value={addForm.phoneNumber} onChange={e => setAddForm({...addForm, phoneNumber: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Address</label>
            <Input value={addForm.address} onChange={e => setAddForm({...addForm, address: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Credit Limit (₱)</label>
            <Input type="number" step="0.01" required value={addForm.creditLimit} onChange={e => setAddForm({...addForm, creditLimit: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Input value={addForm.notes} onChange={e => setAddForm({...addForm, notes: e.target.value})} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title={`Record Payment - ${selectedCustomer?.fullName}`}>
        <form onSubmit={handlePaySubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (₱)</label>
            <Input type="number" step="0.01" required value={payAmount} onChange={e => setPayAmount(e.target.value)} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Payment</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Customer Details - ${selectedCustomer?.fullName}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Phone:</span> {selectedCustomer?.phoneNumber}</div>
            <div><span className="font-medium">Limit:</span> ₱{((selectedCustomer?.creditLimit || 0) / 100).toFixed(2)}</div>
            <div className="col-span-2"><span className="font-medium">Address:</span> {selectedCustomer?.address}</div>
            <div className="col-span-2"><span className="font-medium">Notes:</span> {selectedCustomer?.notes}</div>
          </div>
          
          <h4 className="font-semibold mt-4">Transaction History</h4>
          <div className="max-h-64 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerEntries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{format(e.date, 'MMM d, yyyy')}</TableCell>
                    <TableCell className="capitalize">{e.type}</TableCell>
                    <TableCell className={`text-right ${e.amount > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {e.amount > 0 ? '+' : ''}₱{(e.amount / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {customerEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No transactions</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
