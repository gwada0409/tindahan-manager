import { db } from '@/db/database';
import type { AuditLog, Employee, StockMovement, Store, UserProfile } from '@/types';
import { BaseRepository } from './BaseRepository';

export const storeRepo = new BaseRepository<Store>(db.storeSettings);
export const userProfileRepo = new BaseRepository<UserProfile>(db.userProfiles);
export const employeeRepo = new BaseRepository<Employee>(db.employees,undefined,{database:db,table:db.syncQueue,entityType:'employees'});
export const stockMovementRepo = new BaseRepository<StockMovement>(db.stockMovements);
export const auditLogRepo = new BaseRepository<AuditLog>(db.auditLogs);
