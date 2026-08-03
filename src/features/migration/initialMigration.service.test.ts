import 'fake-indexeddb/auto';import Dexie from 'dexie';import{afterEach,describe,expect,it,vi}from'vitest';import{TindahanDB}from'@/db/database';import{InitialMigrationService}from'./initialMigration.service';import type{SyncAdapter,SyncSummary}from'@/sync/syncTypes';
const success:SyncSummary={attempted:1,processed:1,failed:0,pulled:0};
function adapter(changes:unknown[]=[]):SyncAdapter{return{verifySession:vi.fn(),isReachable:vi.fn(),push:vi.fn(),pull:vi.fn().mockResolvedValue({changes,nextCursor:{changedAt:'2026-01-01T00:00:00Z',id:'00000000-0000-0000-0000-000000000000'},hasMore:false})}as SyncAdapter;}
describe('initial account linking',()=>{let database:TindahanDB|undefined;afterEach(async()=>{if(database){const name=database.name;database.close();await Dexie.delete(name);database=undefined;}});async function setup(){database=new TindahanDB(`migration-${crypto.randomUUID()}`);await database.open();await database.storeSettings.add({id:'local-store',name:'Local',ownerName:'Owner',address:'',contact:'',currency:'PHP',timezone:'Asia/Manila',expirationWarningDays:30,allowNegativeInventory:false,themePreference:'light'});await database.categories.add({id:'cat-local',name:'Drinks',sync:{storeId:'local-store',createdAt:'2025-01-01T00:00:00Z',updatedAt:'2025-01-01T00:00:00Z',deletedAt:null,version:3,baseVersion:2,updatedBy:null,deviceId:'old-device',syncStatus:'pending'}});await database.products.add({id:crypto.randomUUID(),name:'Cola',sku:'COLA',barcode:'',categoryId:'cat-local',unit:'piece',costPrice:1,sellingPrice:2,reorderLevel:1,description:'',active:true});return new InitialMigrationService(database,adapter());}
 it('creates a backup, preserves counts, links records, queues supported data, and validates',async()=>{const service=await setup();const run=vi.fn(async()=>{await database?.syncQueue.clear();return success;});const state=await service.migrate('create-cloud-store','cloud-store','user-1','device-1',run);expect(state.status).toBe('complete');expect(await database?.migrationBackups.count()).toBe(1);const linked=(await database?.categories.toArray())?.[0];expect(linked?.id).toMatch(/^[0-9a-f-]{36}$/i);expect(linked?.sync).toMatchObject({storeId:'cloud-store',deviceId:'device-1',version:1,baseVersion:null});expect((await database?.products.toArray())?.[0]?.categoryId).toBe(linked?.id);expect(state.countsAfter?.categories).toBe(state.countsBefore.categories);});
 it('resumes after a failed sync without duplicating queued operations',async()=>{const service=await setup();const fail=vi.fn().mockResolvedValue({...success,skippedReason:'offline'});await expect(service.migrate('create-cloud-store','cloud-store','user-1','device-1',fail)).rejects.toThrow('offline');expect(await database?.syncQueue.count()).toBe(2);const run=vi.fn(async()=>{await database?.syncQueue.clear();return success;});const state=await service.migrate('create-cloud-store','cloud-store','user-1','device-1',run);expect(state.status).toBe('complete');expect(await database?.migrationBackups.count()).toBe(1);});
 it('detects likely remote duplicates without merging IDs automatically',async()=>{const service=await setup();await database?.products.add({id:'p-local',name:'Rice',sku:'SKU-1',barcode:'',categoryId:'cat-local',unit:'bag',costPrice:1,sellingPrice:2,reorderLevel:1,description:'',active:true});const remote={entityType:'products',changedAt:'2026-01-01T00:00:00Z',record:{id:'p-remote',sku:'SKU-1'}};const analyzed=new InitialMigrationService(database,adapter([remote]));expect((await analyzed.analyze('cloud-store')).duplicates).toEqual([expect.objectContaining({localId:'p-local',remoteId:'p-remote',reason:'matching SKU'})]);});
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
});