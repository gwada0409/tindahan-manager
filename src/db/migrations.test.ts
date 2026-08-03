import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { clearDeviceIdentityForTests } from '@/services/device/deviceIdentityService';
import { TindahanDB } from './database';
import { schemaV3, schemaV4, schemaV5, schemaV6 } from './schema';

describe('database v3 to v4 migration', () => {
  let databaseName: string | undefined;
  let upgraded: TindahanDB | undefined;

  afterEach(async () => {
    upgraded?.close();
    if (databaseName) await Dexie.delete(databaseName);
    clearDeviceIdentityForTests();
  });

  it('preserves primary keys and business data while backfilling sync metadata', async () => {
    databaseName = `migration-test-${crypto.randomUUID()}`;
    const legacy = new Dexie(databaseName);
    legacy.version(3).stores(schemaV3);
    await legacy.open();

    const customerCreatedAt = new Date('2025-02-03T04:05:06.000Z');
    await legacy.table('storeSettings').add({
      id: 'store-existing',
      name: 'Preserved Store',
      ownerName: 'Owner',
      address: 'Address',
      contact: 'Contact',
      currency: 'PHP',
      timezone: 'Asia/Manila',
      expirationWarningDays: 30,
      allowNegativeInventory: false,
      themePreference: 'light',
    });
    await legacy.table('products').add({
      id: 'product-existing',
      name: 'Existing Product',
      categoryId: 'category-existing',
      barcode: '123',
      sku: 'SKU-123',
      unit: 'piece',
      costPrice: 100,
      sellingPrice: 150,
      reorderLevel: 1,
      active: true,
      description: 'Must survive migration',
    });
    await legacy.table('customers').add({
      id: 'customer-existing',
      fullName: 'Existing Customer',
      phoneNumber: '09170000000',
      address: 'Address',
      creditLimit: 10000,
      notes: 'Preserve me',
      active: true,
      createdAt: customerCreatedAt,
    });
    legacy.close();

    upgraded = new TindahanDB(databaseName);
    await upgraded.open();

    const product = await upgraded.products.get('product-existing');
    const customer = await upgraded.customers.get('customer-existing');

    expect(product).toMatchObject({
      id: 'product-existing',
      sellingPrice: 150,
      description: 'Must survive migration',
    });
    expect(product?.sync).toMatchObject({
      storeId: 'store-existing',
      version: 1,
      baseVersion: null,
      deletedAt: null,
      syncStatus: 'pending',
    });
    expect(product?.sync?.deviceId).toBeTruthy();
    expect(customer?.id).toBe('customer-existing');
    expect(customer?.createdAt).toEqual(customerCreatedAt);
    expect(customer?.sync?.createdAt).toBe(customerCreatedAt.toISOString());
  });
});

describe('database v4 to v5 migration', () => {
  let databaseName: string | undefined;
  let upgraded: TindahanDB | undefined;

  afterEach(async () => {
    upgraded?.close();
    if (databaseName) await Dexie.delete(databaseName);
  });

  it('preserves v4 records and adds empty durable sync tables', async () => {
    databaseName = `queue-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(databaseName);
    legacy.version(4).stores(schemaV4);
    await legacy.open();
    await legacy.table('products').add({ id: 'existing-product', name: 'Preserved' });
    legacy.close();

    upgraded = new TindahanDB(databaseName);
    await upgraded.open();

    expect(await upgraded.products.get('existing-product')).toMatchObject({ id: 'existing-product', name: 'Preserved' });
    expect(await upgraded.syncQueue.count()).toBe(0);
    expect(await upgraded.syncState.count()).toBe(0);
    expect(await upgraded.syncConflicts.count()).toBe(0);
  });
});
describe('database v5 to v6 migration', () => {
  let databaseName:string|undefined;let upgraded:TindahanDB|undefined;
  afterEach(async()=>{upgraded?.close();if(databaseName)await Dexie.delete(databaseName);});
  it('preserves v5 business and queue data while adding migration records',async()=>{databaseName=`link-migration-${crypto.randomUUID()}`;const legacy=new Dexie(databaseName);legacy.version(5).stores(schemaV5);await legacy.open();await legacy.table('categories').add({id:'existing',name:'Preserved'});await legacy.table('syncQueue').add({operationId:crypto.randomUUID(),storeId:'store',entityType:'product_categories',entityId:'existing',operation:'upsert',payload:{},createdAt:new Date().toISOString(),attempts:0,status:'pending'});legacy.close();upgraded=new TindahanDB(databaseName);await upgraded.open();expect(await upgraded.categories.get('existing')).toMatchObject({name:'Preserved'});expect(await upgraded.syncQueue.count()).toBe(1);expect(await upgraded.migrationBackups.count()).toBe(0);expect(await upgraded.migrationState.count()).toBe(0);});

  it('preserves v6 data while adding empty sale adjustment records',async()=>{
    databaseName='sales-migration-'+crypto.randomUUID();
    const legacy=new Dexie(databaseName);
    legacy.version(6).stores(schemaV6);
    await legacy.open();
    await legacy.table('sales').add({id:'sale-1',total:100,status:'completed'});
    legacy.close();
    upgraded=new TindahanDB(databaseName);
    await upgraded.open();
    expect(await upgraded.sales.get('sale-1')).toMatchObject({total:100,status:'completed'});
    expect(await upgraded.saleAdjustments.count()).toBe(0);
  });});