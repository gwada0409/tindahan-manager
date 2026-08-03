import {db}from'@/db/database';
import type{Bill,GCashTransaction,PayrollEntry,UtangEntry,VaultTransaction}from'@/types';
import{BaseRepository}from'./BaseRepository';
const queue=(entityType:string)=>({database:db,table:db.syncQueue,entityType});
export const utangEntryRepo=new BaseRepository<UtangEntry>(db.utangEntries,undefined,queue('utang_entries'));
export const gcashTransactionRepo=new BaseRepository<GCashTransaction>(db.gcashTransactions,undefined,queue('gcash_transactions'));
export const billRepo=new BaseRepository<Bill>(db.bills,undefined,queue('bills'));
export const payrollEntryRepo=new BaseRepository<PayrollEntry>(db.payrollEntries,undefined,queue('payroll_entries'));
export const vaultTransactionRepo=new BaseRepository<VaultTransaction>(db.vaultTransactions,undefined,queue('vault_transactions'));