import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { employeesService } from '@/features/employees/employees.service';
import { authService } from '@/features/auth/auth.service';
import { UserRole } from '@/types';
import { Shield, UserPlus, KeyRound } from 'lucide-react';

export function Employees() {
  const employees = useLiveQuery(() => employeesService.getEmployees(), []);
  const userProfiles = useLiveQuery(() => db.userProfiles.toArray(), []);

  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'employees' | 'accounts'>('employees');

  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: '',
    contact: '',
    startDate: '',
    payType: 'daily',
    defaultRate: '',
    notes: ''
  });

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    displayName: '',
    role: 'employee' as UserRole,
    employeeId: ''
  });

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [payrollData, setPayrollData] = useState({
    payPeriodStart: '',
    payPeriodEnd: '',
    baseAmount: '',
    additionalPay: '0',
    deductions: '0',
    notes: ''
  });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await employeesService.addEmployee({
        name: newEmployee.name,
        role: newEmployee.role,
        contact: newEmployee.contact,
        startDate: new Date(newEmployee.startDate),
        payType: newEmployee.payType as any,
        defaultRate: Number(newEmployee.defaultRate) * 100,
        active: true,
        notes: newEmployee.notes,
      });
      setIsAddEmployeeModalOpen(false);
      setNewEmployee({ name: '', role: '', contact: '', startDate: '', payType: 'daily', defaultRate: '', notes: '' });
      showToast('Employee added successfully!');
    } catch (error) {
      showToast('Failed to add employee', 'error');
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.createUserProfile({
        displayName: newAccount.displayName,
        role: newAccount.role,
        employeeId: newAccount.employeeId || undefined
      });
      setIsAddAccountModalOpen(false);
      setNewAccount({ displayName: '', role: 'employee', employeeId: '' });
      showToast('User account created successfully!');
    } catch (error: any) {
      showToast(error.message || 'Failed to create account', 'error');
    }
  };

  const handleToggleAccountActive = async (profileId: string, currentActive: boolean) => {
    try {
      await authService.setAccountActive(profileId, !currentActive);
      showToast(`Account ${!currentActive ? 'activated' : 'deactivated'}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update account status', 'error');
    }
  };

  const handleChangeRole = async (profileId: string, currentRole: UserRole) => {
    const nextRole: UserRole = currentRole === 'admin' ? 'employee' : 'admin';
    try {
      await authService.setAccountRole(profileId, nextRole);
      showToast(`Account role updated to ${nextRole}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update role', 'error');
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const baseAmount = Number(payrollData.baseAmount) * 100;
    const additionalPay = Number(payrollData.additionalPay) * 100;
    const deductions = Number(payrollData.deductions) * 100;
    const netPay = baseAmount + additionalPay - deductions;

    try {
      await employeesService.processPayroll({
        employeeId: selectedEmployee.id,
        payPeriodStart: new Date(payrollData.payPeriodStart),
        payPeriodEnd: new Date(payrollData.payPeriodEnd),
        baseAmount,
        additionalPay,
        deductions,
        netPay,
        paidDate: new Date(),
        paymentMethod: 'cash',
        notes: payrollData.notes,
      });
      setIsPayModalOpen(false);
      setSelectedEmployee(null);
      setPayrollData({ payPeriodStart: '', payPeriodEnd: '', baseAmount: '', additionalPay: '0', deductions: '0', notes: '' });
      showToast('Payroll processed successfully!');
    } catch (error) {
      showToast('Failed to process payroll', 'error');
    }
  };

  const openPayModal = (employee: any) => {
    setSelectedEmployee(employee);
    setPayrollData({
      payPeriodStart: '',
      payPeriodEnd: '',
      baseAmount: (employee.defaultRate / 100).toString(),
      additionalPay: '0',
      deductions: '0',
      notes: ''
    });
    setIsPayModalOpen(true);
  };

  const calculateNetPay = () => {
    const baseAmount = Number(payrollData.baseAmount) || 0;
    const additionalPay = Number(payrollData.additionalPay) || 0;
    const deductions = Number(payrollData.deductions) || 0;
    return baseAmount + additionalPay - deductions;
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Employees & Account Access</h2>
          <p className="text-sm text-muted-foreground">Manage employee payroll and system login accounts</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-lg border border-border">
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'employees' ? 'bg-white shadow-sm text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              Employee Directory
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'accounts' ? 'bg-white shadow-sm text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              User Accounts & RBAC
            </button>
          </div>

          {activeTab === 'employees' ? (
            <Button onClick={() => setIsAddEmployeeModalOpen(true)}>Add Employee</Button>
          ) : (
            <Button onClick={() => setIsAddAccountModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add User Account
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'employees' ? (
        <Card>
          <CardHeader>
            <CardTitle>Employee Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role / Position</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Pay Schedule</TableHead>
                  <TableHead className="text-right">Default Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees?.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.role}</TableCell>
                    <TableCell>{emp.contact}</TableCell>
                    <TableCell className="capitalize">{emp.payType.replace('-', ' ')}</TableCell>
                    <TableCell className="text-right font-mono">₱{(emp.defaultRate / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openPayModal(emp)}>Process Pay</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!employees || employees.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No employees found. Add one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Application User Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userProfiles?.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.displayName}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        profile.role === 'admin' 
                          ? 'bg-primary/15 text-primary border border-primary/20' 
                          : 'bg-muted text-muted-foreground border'
                      }`}>
                        {profile.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        profile.active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-destructive/15 text-destructive'
                      }`}>
                        {profile.active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleChangeRole(profile.id, profile.role)}
                      >
                        Switch to {profile.role === 'admin' ? 'Employee' : 'Admin'}
                      </Button>
                      <Button 
                        variant={profile.active ? 'destructive' : 'outline'} 
                        size="sm"
                        onClick={() => handleToggleAccountActive(profile.id, profile.active)}
                      >
                        {profile.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!userProfiles || userProfiles.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No user accounts created yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Employee Modal */}
      <Modal isOpen={isAddEmployeeModalOpen} onClose={() => setIsAddEmployeeModalOpen(false)} title="Add Employee">
        <form onSubmit={handleAddEmployee} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input required value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Role / Position</label>
            <Input required value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Contact</label>
            <Input value={newEmployee.contact} onChange={e => setNewEmployee({...newEmployee, contact: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input type="date" required value={newEmployee.startDate} onChange={e => setNewEmployee({...newEmployee, startDate: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Pay Schedule</label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={newEmployee.payType} 
              onChange={e => setNewEmployee({...newEmployee, payType: e.target.value})}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="semi-monthly">Semi-monthly</option>
              <option value="monthly">Monthly</option>
              <option value="per-job">Per-job</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Rate (₱)</label>
            <Input type="number" step="0.01" required value={newEmployee.defaultRate} onChange={e => setNewEmployee({...newEmployee, defaultRate: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input value={newEmployee.notes} onChange={e => setNewEmployee({...newEmployee, notes: e.target.value})} />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddEmployeeModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Employee</Button>
          </div>
        </form>
      </Modal>

      {/* Add Account Modal */}
      <Modal isOpen={isAddAccountModalOpen} onClose={() => setIsAddAccountModalOpen(false)} title="Create Application User Account">
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name *</label>
            <Input required value={newAccount.displayName} onChange={e => setNewAccount({...newAccount, displayName: e.target.value})} placeholder="e.g. Maria Santos" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">System Role *</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newAccount.role}
              onChange={e => setNewAccount({...newAccount, role: e.target.value as UserRole})}
            >
              <option value="employee">Employee (Restricted Access)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Link to Employee Record (Optional)</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newAccount.employeeId}
              onChange={e => setNewAccount({...newAccount, employeeId: e.target.value})}
            >
              <option value="">None (Standalone Account)</option>
              {employees?.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddAccountModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create User Account</Button>
          </div>
        </form>
      </Modal>

      {/* Process Pay Modal */}
      <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title={`Pay ${selectedEmployee?.name}`}>
        <form onSubmit={handlePay} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pay Period Start</label>
              <Input type="date" required value={payrollData.payPeriodStart} onChange={e => setPayrollData({...payrollData, payPeriodStart: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Pay Period End</label>
              <Input type="date" required value={payrollData.payPeriodEnd} onChange={e => setPayrollData({...payrollData, payPeriodEnd: e.target.value})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Base Amount (₱)</label>
            <Input type="number" step="0.01" required value={payrollData.baseAmount} onChange={e => setPayrollData({...payrollData, baseAmount: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Pay (₱)</label>
            <Input type="number" step="0.01" value={payrollData.additionalPay} onChange={e => setPayrollData({...payrollData, additionalPay: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Deductions (₱)</label>
            <Input type="number" step="0.01" value={payrollData.deductions} onChange={e => setPayrollData({...payrollData, deductions: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input value={payrollData.notes} onChange={e => setPayrollData({...payrollData, notes: e.target.value})} />
          </div>
          <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
            <span className="font-medium">Net Pay:</span>
            <span className="text-xl font-bold font-mono">₱{calculateNetPay().toFixed(2)}</span>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)}>Cancel</Button>
            <Button type="submit">Process Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
