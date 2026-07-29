import { db } from '@/db/database';
import { Employee, PayrollEntry } from '@/types';
import { generateId } from '@/shared/utils/id';

export class EmployeesService {
  async getEmployees(): Promise<Employee[]> {
    // Employees list is typically small enough for toArray(), but we can paginate if needed.
    return await db.employees.toArray();
  }

  async addEmployee(data: Omit<Employee, 'id'>): Promise<string> {
    const id = generateId();
    await db.employees.add({ ...data, id });
    return id;
  }

  async processPayroll(data: Omit<PayrollEntry, 'id'>): Promise<string> {
    const id = generateId();
    await db.payrollEntries.add({ ...data, id });
    return id;
  }
}

export const employeesService = new EmployeesService();
