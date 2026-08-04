import 'fake-indexeddb/auto';import Dexie from 'dexie';import{afterEach,describe,expect,it,vi}from'vitest';import{TindahanDB}from'@/db/database';import{InitialMigrationService}from'./initialMigration.service';import type{SyncAdapter,SyncSummary}from'@/sync/syncTypes';
const success:SyncSummary={attempted:1,processed:1,failed:0,pulled:0};
function adapter(changes:unknown[]=[]):SyncAdapter{return{verifySession:vi.fn(),isReachable:vi.fn(),push:vi.fn(),pull:vi.fn().mockResolvedValue({changes,nextCursor:{changedAt:'2026-01-01T00:00:00Z',id:'00000000-0000-0000-0000-000000000000'},hasMore:false})}as SyncAdapter;}
describe('initial account linking',()=>{let database:TindahanDB|undefined;afterEach(async()=>{if(database){const name=database.name;database.close();await Dexie.delete(name);database=undefined;}});async function setup(){database=new TindahanDB(`migration-${crypto.randomUUID()}`);await database.open();await database.storeSettings.add({id:'local-store',name:'Local',ownerName:'Owner',address:'',contact:'',currency:'PHP',timezone:'Asia/Manila',expirationWarningDays:30,allowNegativeInventory:false,themePreference:'light'});await database.categories.add({id:'cat-local',name:'Drinks',sync:{storeId:'local-store',createdAt:'2025-01-01T00:00:00Z',updatedAt:'2025-01-01T00:00:00Z',deletedAt:null,version:3,baseVersion:2,updatedBy:null,deviceId:'old-device',syncStatus:'pending'}});await database.products.add({id:crypto.randomUUID(),name:'Cola',sku:'COLA',barcode:'',categoryId:'cat-local',unit:'piece',costPrice:1,sellingPrice:2,reorderLevel:1,description:'',active:true});return new InitialMigrationService(database,adapter());}
 it('creates a backup, preserves counts, links records, queues supported data, and validates',async()=>{const service=await setup();const run=vi.fn(async()=>{await database?.syncQueue.clear();return success;});const state=await service.migrate('create-cloud-store','cloud-store','user-1','device-1',run);expect(state.status).toBe('complete');expect(await database?.migrationBackups.count()).toBe(1);const linked=(await database?.categories.toArray())?.[0];expect(linked?.id).toMatch(/^[0-9a-f-]{36}$/i);expect(linked?.sync).toMatchObject({storeId:'cloud-store',deviceId:'device-1',version:1,baseVersion:null});expect((await database?.products.toArray())?.[0]?.categoryId).toBe(linked?.id);expect(state.countsAfter?.categories).toBe(state.countsBefore.categories);});
 it('resumes after a failed sync without duplicating queued operations',async()=>{const service=await setup();const fail=vi.fn().mockResolvedValue({...success,skippedReason:'offline'});await expect(service.migrate('create-cloud-store','cloud-store','user-1','device-1',fail)).rejects.toThrow('offline');expect(await database?.syncQueue.count()).toBe(2);const run=vi.fn(async()=>{await database?.syncQueue.clear();return success;});const state=await service.migrate('create-cloud-store','cloud-store','user-1','device-1',run);expect(state.status).toBe('complete');expect(await database?.migrationBackups.count()).toBe(1);});
 it('reports the failed entity and cloud-safe error instead of a batch-limit message',async()=>{const service=await setup();const fail=vi.fn(async()=>{const queued=await database!.syncQueue.toArray();for(const item of queued)if(item.queueId!==undefined)await database!.syncQueue.update(item.queueId,{status:'failed',lastError:'Record version conflict'});return{attempted:queued.length,processed:0,failed:queued.length,pulled:0};});await expect(service.migrate('create-cloud-store','cloud-store','user-1','device-1',fail)).rejects.toThrow('Record version conflict');});
 it('acknowledges a matching same-version cloud row left by an interrupted migration',async()=>{await setup();await database!.categories.clear();const sync={storeId:'cloud-store',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',deletedAt:null,version:1,baseVersion:null,updatedBy:'user-1',deviceId:'device-1',syncStatus:'pending' as const};const category={id:crypto.randomUUID(),name:'General',sync};await database!.categories.put(category);await database!.syncQueue.add({operationId:crypto.randomUUID(),storeId:'cloud-store',entityType:'product_categories',entityId:category.id,operation:'upsert',payload:category,createdAt:sync.createdAt,attempts:1,status:'failed',lastError:'Record version conflict'});const cloud=adapter([{entityType:'product_categories',changedAt:sync.updatedAt,record:{id:category.id,store_id:'cloud-store',name:'General',version:1,updated_at:sync.updatedAt,updated_by:'user-1',device_id:'device-1'}}]);const service=new InitialMigrationService(database,cloud);const acknowledged=await(service as unknown as{acknowledgeAlreadyUploadedMasterOperations:(storeId:string)=>Promise<number>}).acknowledgeAlreadyUploadedMasterOperations('cloud-store');expect(acknowledged).toBe(1);expect(await database!.syncQueue.count()).toBe(0);expect(await database!.categories.get(category.id)).toMatchObject({sync:{syncStatus:'synced',baseVersion:null}});});
 it('accepts the cloud copy when the recorded pre-migration table was empty',async()=>{await setup();await database!.categories.clear();const sync={storeId:'cloud-store',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',deletedAt:null,version:1,baseVersion:null,updatedBy:'new-user',deviceId:'new-device',syncStatus:'pending' as const};const category={id:crypto.randomUUID(),name:'General',sync};await database!.categories.put(category);await database!.syncQueue.add({operationId:crypto.randomUUID(),storeId:'cloud-store',entityType:'product_categories',entityId:category.id,operation:'upsert',payload:category,createdAt:sync.createdAt,attempts:3,status:'failed',lastError:'Record version conflict'});const cloud=adapter([{entityType:'product_categories',changedAt:sync.updatedAt,record:{id:category.id,store_id:'cloud-store',name:'General',version:1,updated_at:'2026-01-02T00:00:00.000Z',updated_by:'different-user',device_id:'different-device'}}]);const service=new InitialMigrationService(database,cloud);const acknowledged=await(service as unknown as{acknowledgeAlreadyUploadedMasterOperations:(storeId:string,counts:Record<string,number>)=>Promise<number>}).acknowledgeAlreadyUploadedMasterOperations('cloud-store',{categories:0});expect(acknowledged).toBe(1);expect(await database!.syncQueue.count()).toBe(0);});
 it('acknowledges same-version cloud content even when receipt metadata changed',async()=>{await setup();await database!.categories.clear();const sync={storeId:'cloud-store',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',deletedAt:null,version:1,baseVersion:null,updatedBy:'new-user',deviceId:'new-device',syncStatus:'pending' as const};const category={id:crypto.randomUUID(),name:'General',sync};await database!.categories.put(category);await database!.syncQueue.add({operationId:crypto.randomUUID(),storeId:'cloud-store',entityType:'product_categories',entityId:category.id,operation:'upsert',payload:category,createdAt:sync.createdAt,attempts:3,status:'failed',lastError:'Record version conflict'});const cloud=adapter([{entityType:'product_categories',changedAt:'2026-01-02T00:00:00.000Z',record:{id:category.id,store_id:'cloud-store',name:'General',version:1,updated_at:'2026-01-02T00:00:00.000Z',updated_by:'different-user',device_id:'different-device'}}]);const service=new InitialMigrationService(database,cloud);const acknowledged=await(service as unknown as{acknowledgeAlreadyUploadedMasterOperations:(storeId:string,counts:Record<string,number>)=>Promise<number>}).acknowledgeAlreadyUploadedMasterOperations('cloud-store',{categories:1});expect(acknowledged).toBe(1);expect(await database!.syncQueue.count()).toBe(0);});
 it('acknowledges an identical product after cloud receipt metadata changes',async()=>{await setup();await database!.products.clear();const sync={storeId:'cloud-store',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',deletedAt:null,version:1,baseVersion:null,updatedBy:'new-user',deviceId:'new-device',syncStatus:'pending' as const};const product={id:crypto.randomUUID(),name:'Cola',sku:'COLA',barcode:'1',categoryId:'cat-1',supplierId:undefined,unit:'piece',costPrice:10,sellingPrice:15,reorderLevel:2,description:'',active:true,sync};await database!.products.put(product);await database!.syncQueue.add({operationId:crypto.randomUUID(),storeId:'cloud-store',entityType:'products',entityId:product.id,operation:'upsert',payload:product,createdAt:sync.createdAt,attempts:3,status:'failed',lastError:'Record version conflict'});const cloud=adapter([{entityType:'products',changedAt:'2026-01-02T00:00:00.000Z',record:{id:product.id,store_id:'cloud-store',name:'Cola',sku:'COLA',barcode:'1',category_id:'cat-1',supplier_id:null,unit:'piece',cost_price:10,selling_price:15,reorder_level:2,description:'',active:true,version:1,updated_at:'2026-01-02T00:00:00.000Z',updated_by:'different-user',device_id:'different-device'}}]);const service=new InitialMigrationService(database,cloud);const acknowledged=await(service as unknown as{acknowledgeAlreadyUploadedMasterOperations:(storeId:string,counts:Record<string,number>)=>Promise<number>}).acknowledgeAlreadyUploadedMasterOperations('cloud-store',{products:1});expect(acknowledged).toBe(1);expect(await database!.syncQueue.count()).toBe(0);}); it('keeps a same-version cloud row queued when its business content differs',async()=>{await setup();await database!.categories.clear();const sync={storeId:'cloud-store',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',deletedAt:null,version:1,baseVersion:null,updatedBy:'new-user',deviceId:'new-device',syncStatus:'pending' as const};const category={id:crypto.randomUUID(),name:'Local name',sync};await database!.categories.put(category);await database!.syncQueue.add({operationId:crypto.randomUUID(),storeId:'cloud-store',entityType:'product_categories',entityId:category.id,operation:'upsert',payload:category,createdAt:sync.createdAt,attempts:3,status:'failed',lastError:'Record version conflict'});const cloud=adapter([{entityType:'product_categories',changedAt:'2026-01-02T00:00:00.000Z',record:{id:category.id,store_id:'cloud-store',name:'Cloud name',version:1,updated_at:'2026-01-02T00:00:00.000Z',updated_by:'different-user',device_id:'different-device'}}]);const service=new InitialMigrationService(database,cloud);const acknowledged=await(service as unknown as{acknowledgeAlreadyUploadedMasterOperations:(storeId:string,counts:Record<string,number>)=>Promise<number>}).acknowledgeAlreadyUploadedMasterOperations('cloud-store',{categories:1});expect(acknowledged).toBe(0);expect(await database!.syncQueue.count()).toBe(1);}); it('detects likely remote duplicates without merging IDs automatically',async()=>{const service=await setup();await database?.products.add({id:'p-local',name:'Rice',sku:'SKU-1',barcode:'',categoryId:'cat-local',unit:'bag',costPrice:1,sellingPrice:2,reorderLevel:1,description:'',active:true});const remote={entityType:'products',changedAt:'2026-01-01T00:00:00Z',record:{id:'p-remote',sku:'SKU-1'}};const analyzed=new InitialMigrationService(database,adapter([remote]));expect((await analyzed.analyze('cloud-store')).duplicates).toEqual([expect.objectContaining({localId:'p-local',remoteId:'p-remote',reason:'matching SKU'})]);});
 it('backs up before explicit new-device clearing',async()=>{const service=await setup();const run=vi.fn(async()=>{await database?.categories.add({id:'cloud-cat',name:'Cloud'});return{...success,attempted:0,processed:0,pulled:1};});const state=await service.migrate('download-cloud','cloud-store','user-1','device-1',run);expect(state.status).toBe('complete');expect(await database?.migrationBackups.count()).toBe(1);expect(await database?.categories.toArray()).toEqual([expect.objectContaining({id:'cloud-cat'})]);});

  it('queues existing inventory movements and completed sales during account linking', async () => {
    const service = await setup();
    const product = (await database?.products.toArray())?.[0];
    const batchId = crypto.randomUUID();
    const restockId = crypto.randomUUID();
    const saleMovementId = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    const saleItemId = crypto.randomUUID();
    const occurredAt = new Date('2026-01-02T00:00:00Z');

    await database?.inventoryBatches.add({
      id: batchId,
      productId: product!.id,
      quantityReceived: 10,
      remainingQuantity: 8,
      unitCost: 100,
      restockDate: occurredAt,
      referenceNumber: 'OPEN',
      notes: '',
    });
    await database?.stockMovements.bulkAdd([
      {
        id: restockId,
        productId: product!.id,
        batchId,
        type: 'restock',
        quantity: 10,
        date: occurredAt,
        referenceId: batchId,
        notes: '',
      },
      {
        id: saleMovementId,
        productId: product!.id,
        batchId,
        type: 'sale',
        quantity: -2,
        date: occurredAt,
        referenceId: saleId,
        notes: '',
      },
    ]);
    await database?.sales.add({
      id: saleId,
      date: occurredAt,
      subtotal: 200,
      discount: 0,
      total: 200,
      paymentMethod: 'cash',
      amountReceived: 200,
      changeAmount: 0,
      status: 'completed',
    });
    await database?.saleItems.add({
      id: saleItemId,
      saleId,
      itemId: product!.id,
      itemType: 'product',
      name: 'Cola',
      quantity: 2,
      unitPrice: 100,
      discount: 0,
      total: 200,
      batchId,
    });

    const uploaded: import('@/domain/sync/sync.types').SyncQueueItem[] = [];
    const run = vi.fn(async () => {
      uploaded.push(...((await database?.syncQueue.toArray()) ?? []));
      await database?.syncQueue.clear();
      return { ...success, attempted: uploaded.length, processed: uploaded.length };
    });
    const state = await service.migrate('create-cloud-store', 'cloud-store', 'user-1', 'device-1', run);

    expect(state.processedTables).toContain('__inventory_sales_v2__');
    expect(uploaded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'inventory_restock', entityId: batchId }),
        expect.objectContaining({ entityType: 'inventory_movement', entityId: saleMovementId }),
        expect.objectContaining({
          entityType: 'sale_transaction',
          entityId: saleId,
          payload: expect.objectContaining({
            items: [expect.objectContaining({ id: saleItemId })],
            stockMovements: [expect.objectContaining({ id: saleMovementId })],
          }),
        }),
      ]),
    );
  });

  it('refreshes the backup and validation baseline for a legacy completed migration', async () => {
    const service = await setup();
    await database?.migrationState.put({
      id: 'initial:cloud-store',
      mode: 'create-cloud-store',
      status: 'complete',
      targetStoreId: 'cloud-store',
      backupId: 'legacy-backup',
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      processedTables: ['categories', 'products'],
      countsBefore: { categories: 0, products: 0, auditLogs: 0 },
      totalsBefore: {},
      duplicateCount: 0,
    });
    await database?.auditLogs.add({ id: crypto.randomUUID(), date: new Date('2026-01-02T00:00:00Z'), action: 'auth:sign-in', entityType: 'user', entityId: 'user-1', details: '{}' });

    const run = vi.fn(async () => { await database?.syncQueue.clear(); return success; });
    const state = await service.migrate('create-cloud-store', 'cloud-store', 'user-1', 'device-1', run);

    expect(state.status).toBe('complete');
    expect(state.processedTables).toContain('__inventory_sales_baseline_v3__');
    expect(state.countsBefore.auditLogs).toBe(1);
    expect(await database?.migrationBackups.count()).toBe(1);
  });
});