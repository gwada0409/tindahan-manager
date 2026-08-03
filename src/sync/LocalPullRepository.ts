import { db,type TindahanDB } from '@/db/database';
import type { PullCursor,SyncMetadata,SyncState } from '@/domain/sync/sync.types';
import { ConflictRepository } from './ConflictRepository';
import type { PullChange,PullEntityType } from './syncTypes';

const EPOCH:PullCursor={changedAt:'1970-01-01T00:00:00.000Z',id:'00000000-0000-0000-0000-000000000000'};
const names:Record<PullEntityType,string>={product_categories:'categories',suppliers:'suppliers',products:'products',customers:'customers',inventory_batches:'inventoryBatches',stock_movements:'stockMovements',utang_entries:'utangEntries',gcash_transactions:'gcashTransactions',bills:'bills',employees:'employees',payroll_entries:'payrollEntries',vault_transactions:'vaultTransactions'};
const priority:Record<PullEntityType,number>={product_categories:0,suppliers:1,customers:2,products:3,inventory_batches:4,stock_movements:5,employees:6,bills:7,utang_entries:8,gcash_transactions:9,payroll_entries:10,vault_transactions:11};
const str=(r:Record<string,unknown>,key:string,empty='')=>typeof r[key]==='string'?r[key] as string:empty;
const nullable=(r:Record<string,unknown>,key:string)=>typeof r[key]==='string'?r[key] as string:undefined;
const num=(r:Record<string,unknown>,key:string)=>typeof r[key]==='number'?r[key] as number:0;
const sync=(r:Record<string,unknown>):SyncMetadata=>({storeId:str(r,'store_id'),createdAt:str(r,'created_at'),updatedAt:str(r,'updated_at'),deletedAt:typeof r.deleted_at==='string'?r.deleted_at:null,version:num(r,'version'),baseVersion:null,updatedBy:nullable(r,'updated_by')??null,deviceId:str(r,'device_id'),syncStatus:'synced'});
function record(change:PullChange):Record<string,unknown>{
 const r=change.record;const base={id:str(r,'id'),sync:sync(r)};
 switch(change.entityType){
  case'product_categories':return{...base,name:str(r,'name')};
  case'suppliers':return{...base,name:str(r,'name'),contactPerson:str(r,'contact_person'),phone:str(r,'phone'),email:str(r,'email'),address:str(r,'address'),notes:str(r,'notes')};
  case'products':return{...base,name:str(r,'name'),sku:str(r,'sku'),barcode:str(r,'barcode'),categoryId:str(r,'category_id'),unit:str(r,'unit','piece'),costPrice:num(r,'cost_price'),sellingPrice:num(r,'selling_price'),reorderLevel:num(r,'reorder_level'),supplierId:nullable(r,'supplier_id'),description:str(r,'description'),active:r.active!==false};
  case'customers':return{...base,fullName:str(r,'full_name'),phoneNumber:str(r,'phone_number'),address:str(r,'address'),creditLimit:num(r,'credit_limit'),notes:str(r,'notes'),active:r.active!==false,createdAt:new Date(str(r,'created_at'))};
  case'inventory_batches':return{...base,productId:str(r,'product_id'),supplierId:nullable(r,'supplier_id'),quantityReceived:num(r,'quantity_received'),remainingQuantity:0,unitCost:num(r,'unit_cost'),restockDate:new Date(str(r,'restock_date')),expirationDate:nullable(r,'expiration_date')?new Date(str(r,'expiration_date')):undefined,referenceNumber:str(r,'reference_number'),notes:str(r,'notes')};
  case'stock_movements':return{...base,productId:str(r,'product_id'),batchId:nullable(r,'batch_id'),type:str(r,'movement_type'),quantity:num(r,'signed_quantity'),date:new Date(str(r,'occurred_at')),referenceId:nullable(r,'reference_id'),notes:str(r,'notes')};  case'utang_entries':return{...base,customerId:str(r,'customer_id'),date:new Date(str(r,'occurred_at')),type:str(r,'entry_type'),amount:num(r,'amount'),referenceId:nullable(r,'reference_id'),notes:str(r,'notes')};
  case'gcash_transactions':return{...base,date:new Date(str(r,'occurred_at')),type:str(r,'transaction_type'),amount:num(r,'amount'),serviceFee:num(r,'service_fee'),customerId:nullable(r,'customer_id'),referenceNumber:str(r,'reference_number'),notes:str(r,'notes')};
  case'bills':return{...base,name:str(r,'name'),category:str(r,'category'),provider:str(r,'provider'),amount:num(r,'amount'),dueDate:new Date(str(r,'due_date')),recurrence:str(r,'recurrence'),status:str(r,'status'),paidDate:nullable(r,'paid_date')?new Date(str(r,'paid_date')):undefined,paymentMethod:nullable(r,'payment_method'),referenceNumber:nullable(r,'reference_number'),notes:str(r,'notes')};
  case'employees':return{...base,name:str(r,'name'),role:str(r,'role'),contact:str(r,'contact'),startDate:new Date(str(r,'start_date')),payType:str(r,'pay_type'),defaultRate:num(r,'default_rate'),active:r.active!==false,notes:str(r,'notes')};
  case'payroll_entries':return{...base,employeeId:str(r,'employee_id'),payPeriodStart:new Date(str(r,'pay_period_start')),payPeriodEnd:new Date(str(r,'pay_period_end')),baseAmount:num(r,'base_amount'),additionalPay:num(r,'additional_pay'),deductions:num(r,'deductions'),netPay:num(r,'net_pay'),paidDate:new Date(str(r,'paid_date')),paymentMethod:str(r,'payment_method'),notes:str(r,'notes')};
  case'vault_transactions':return{...base,date:new Date(str(r,'occurred_at')),type:str(r,'transaction_type'),amount:num(r,'amount'),referenceId:nullable(r,'reference_id'),notes:str(r,'notes')};
 }
}
export class LocalPullRepository{
 private readonly database:TindahanDB;
 constructor(database:TindahanDB=db){this.database=database;}
 private stateId(storeId:string){return'pull:'+storeId;}
 async cursor(storeId:string):Promise<PullCursor>{return(await this.database.syncState.get(this.stateId(storeId)))?.pullCursor??EPOCH;}
 async applyPage(storeId:string,changes:PullChange[],cursor:PullCursor):Promise<void>{
  const ordered=[...changes].sort((a,b)=>priority[a.entityType]-priority[b.entityType]);
  for(const change of ordered){
   if(['stock_movements','utang_entries','gcash_transactions','payroll_entries','vault_transactions'].includes(change.entityType))continue;
   const remoteRecord=record(change);const id=remoteRecord.id as string;const table=this.database.table(names[change.entityType]);
   const current=await table.get(id) as {sync?:SyncMetadata}|undefined;const remote=remoteRecord.sync as SyncMetadata;
   if(current?.sync?.syncStatus==='conflict')throw new Error('Unresolved sync conflict blocks pull for '+change.entityType+':'+id);
   if(current?.sync?.syncStatus==='pending'&&current.sync.baseVersion!==remote.version){
    await new ConflictRepository(this.database).record({storeId,entityType:change.entityType,entityId:id,detectedAt:new Date().toISOString(),localPayload:current,remotePayload:remoteRecord,baseVersion:current.sync.baseVersion,localVersion:current.sync.version,serverVersion:remote.version,localEditor:current.sync.updatedBy,remoteEditor:remote.updatedBy,localDevice:current.sync.deviceId,remoteDevice:remote.deviceId,localUpdatedAt:current.sync.updatedAt,remoteUpdatedAt:remote.updatedAt});
    await table.update(id,{sync:{...current.sync,syncStatus:'conflict'}});
    throw new Error('Pending local change blocks pull for '+change.entityType+':'+id);
   }
   if(current?.sync?.syncStatus==='pending')throw new Error('Pending local change awaits upload for '+change.entityType+':'+id);
  }
  await this.database.transaction('rw',[this.database.categories,this.database.suppliers,this.database.customers,this.database.products,this.database.inventoryBatches,this.database.stockMovements,this.database.utangEntries,this.database.gcashTransactions,this.database.bills,this.database.employees,this.database.payrollEntries,this.database.vaultTransactions,this.database.syncState],async()=>{
   for(const change of ordered){
    const local=record(change);const id=local.id as string;const table=this.database.table(names[change.entityType]);const current=await table.get(id) as {sync?:SyncMetadata;remainingQuantity?:number}|undefined;
    if(change.entityType==='stock_movements'){
      if(current)continue;
      const batchId=local.batchId as string|undefined;if(!batchId)throw new Error('Stock movement has no batch.');
      const batch=await this.database.inventoryBatches.get(batchId);if(!batch)throw new Error('Missing inventory batch: '+batchId);
      await table.add(local);await this.database.inventoryBatches.update(batchId,{remainingQuantity:batch.remainingQuantity+(local.quantity as number)});continue;
    }
    if(['utang_entries','gcash_transactions','payroll_entries','vault_transactions'].includes(change.entityType)){if(!current)await table.add(local);continue;}
    if(change.entityType==='inventory_batches'){if(!await this.database.products.get(local.productId as string))throw new Error('Missing batch product.');if(current)local.remainingQuantity=current.remainingQuantity??0;await table.put(local);continue;}
    const remote=local.sync as SyncMetadata;if(current?.sync?.syncStatus==='pending'&&current.sync.version!==remote.version)throw new Error('Pending local change blocks pull for '+change.entityType+':'+id);
    if(change.entityType==='products'){if(!await this.database.categories.get(local.categoryId as string))throw new Error('Missing product category.');const supplier=local.supplierId as string|undefined;if(supplier&&!await this.database.suppliers.get(supplier))throw new Error('Missing product supplier.');}
    await table.put(local);
   }
   const id=this.stateId(storeId);const previous=await this.database.syncState.get(id);const state:SyncState={...previous,id,storeId,pullCursor:cursor,lastPulledAt:cursor.changedAt};await this.database.syncState.put(state);
  });
 }
 async markSuccessful(storeId:string,cursor:PullCursor):Promise<void>{const id=this.stateId(storeId);const current=await this.database.syncState.get(id);await this.database.syncState.put({...current,id,storeId,pullCursor:cursor,lastPulledAt:cursor.changedAt,lastSuccessfulSyncAt:cursor.changedAt});}
}