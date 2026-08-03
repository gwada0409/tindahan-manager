import { employeeRepo } from '@/repositories/EntityRepositories';
import { payrollEntryRepo } from '@/repositories/FinancialRepository';
import type { Employee, PayrollEntry } from '@/types';

export class EmployeesService {
  async getEmployees(): Promise<Employee[]> {
    return employeeRepo.list();
  }

  async addEmployee(data: Omit<Employee, 'id' | 'sync'>): Promise<string> {
    return employeeRepo.add(data);
  }

  async processPayroll(data: Omit<PayrollEntry, 'id' | 'sync'>): Promise<string> {
    return payrollEntryRepo.add(data);
  }
}

export const employeesService = new EmployeesService();
