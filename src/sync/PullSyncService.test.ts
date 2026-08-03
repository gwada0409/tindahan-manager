import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TindahanDB } from '@/db/database';
import { LocalPullRepository } from './LocalPullRepository';
import { PullSyncService } from './PullSyncService';
import type { PullChange, SyncAdapter } from './syncTypes';

const cursor=(changedAt:string,id:string)=>({changedAt,id});
function category(id='cat-1',deletedAt:null|string=null):PullChange{return{entityType:'product_categories',changedAt:'2026-01-01T00:00:01Z',record:{id,store_id:'store-1',name:'Drinks',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:01Z',deleted_at:deletedAt,version:1,updated_by:'user-2',device_id:'device-2'}};}
function product(categoryId='cat-1'):PullChange{return{entityType:'products',changedAt:'2026-01-01T00:00:02Z',record:{id:'product-1',store_id:'store-1',category_id:categoryId,supplier_id:null,name:'Cola',sku:'COLA',barcode:'1',unit:'piece',cost_price:10,selling_price:15,reorder_level:2,description:'',active:true,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:02Z',deleted_at:null,version:1,updated_by:'user-2',device_id:'device-2'}};}

describe('incremental pull application',()=>{
  let database:TindahanDB|undefined;
  afterEach(async()=>{if(database){const name=database.name;database.close();await Dexie.delete(name);database=undefined;}});
  async function setup(){database=new TindahanDB(`pull-${crypto.randomUUID()}`);await database.open();return new LocalPullRepository(database);}

  it('applies dependency-ordered records and cursor atomically without queueing',async()=>{
    const local=await setup(); const next=cursor('2026-01-01T00:00:02Z','product-1');
    await local.applyPage('store-1',[product(),category()],next);
    expect(await database?.products.get('product-1')).toMatchObject({name:'Cola',sync:{syncStatus:'synced'}});
    expect(await local.cursor('store-1')).toEqual(next);
    expect(await database?.syncQueue.count()).toBe(0);
  });

  it('is idempotent for duplicate pulls and preserves soft-deleted rows',async()=>{
    const local=await setup();const next=cursor('2026-01-01T00:00:01Z','cat-1');const change=category('cat-1','2026-01-02T00:00:00Z');
    await local.applyPage('store-1',[change],next);await local.applyPage('store-1',[change],next);
    expect(await database?.categories.count()).toBe(1);
    expect((await database?.categories.get('cat-1'))?.sync?.deletedAt).toBe('2026-01-02T00:00:00Z');
  });

  it('rolls back records and retains the prior cursor when a parent is missing',async()=>{
    const local=await setup();const initial=await local.cursor('store-1');
    await expect(local.applyPage('store-1',[product('missing-category')],cursor('2026-01-01T00:00:02Z','product-1'))).rejects.toThrow('Missing product category');
    expect(await database?.products.count()).toBe(0);expect(await local.cursor('store-1')).toEqual(initial);
  });

  it('retains the prior cursor instead of overwriting a pending local edit',async()=>{
    const local=await setup();await database?.categories.put({id:'cat-1',name:'Local',sync:{storeId:'store-1',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',deletedAt:null,version:2,baseVersion:1,updatedBy:'user-1',deviceId:'device-1',syncStatus:'pending'}});
    const initial=await local.cursor('store-1');const remoteEdit=category();remoteEdit.record.version=2;await expect(local.applyPage('store-1',[remoteEdit],cursor('2026-01-01T00:00:01Z','cat-1'))).rejects.toThrow('Pending local change');expect(await local.cursor('store-1')).toEqual(initial);expect((await database?.categories.get('cat-1'))?.name).toBe('Local');expect((await database?.categories.get('cat-1'))?.sync?.syncStatus).toBe('conflict');expect(await database?.syncConflicts.count()).toBe(1);
  });

  it('paginates from the server cursor and records successful completion',async()=>{
    const local=await setup();const c1=cursor('2026-01-01T00:00:01Z','cat-1');const c2=cursor('2026-01-01T00:00:02Z','cat-2');
    const pull=vi.fn().mockResolvedValueOnce({changes:[category('cat-1')],nextCursor:c1,hasMore:true}).mockResolvedValueOnce({changes:[category('cat-2')],nextCursor:c2,hasMore:false});
    const adapter={pull} as unknown as SyncAdapter;
    expect(await new PullSyncService(local,adapter,1).pullAll('store-1')).toBe(2);
    expect(pull.mock.calls[1]?.[1]).toEqual(c1);expect((await database?.syncState.get('pull:store-1'))?.lastSuccessfulSyncAt).toBe(c2.changedAt);
  });

  it('pulls immutable sale headers before their line items and ignores duplicate pages', async () => {
    const local = await setup();
    const metadata = {
      store_id: 'store-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      version: 1,
      updated_by: 'user-2',
      device_id: 'device-2',
    };
    const sale: PullChange = {
      entityType: 'sales',
      changedAt: '2026-01-01T00:00:03Z',
      record: {
        ...metadata,
        id: 'sale-1',
        occurred_at: '2026-01-01T00:00:00Z',
        subtotal: 150,
        discount: 0,
        total: 150,
        payment_method: 'cash',
        amount_received: 200,
        change_amount: 50,
        reference_number: null,
        customer_id: null,
        status: 'completed',
        void_reason: null,
        operation_id: 'op-1',
      },
    };
    const item: PullChange = {
      entityType: 'sale_items',
      changedAt: '2026-01-01T00:00:04Z',
      record: {
        ...metadata,
        id: 'item-1',
        sale_id: 'sale-1',
        item_id: 'product-1',
        item_type: 'product',
        name: 'Cola',
        quantity: 1,
        unit_price: 150,
        discount: 0,
        total: 150,
        batch_id: null,
      },
    };
    const next = cursor('2026-01-01T00:00:04Z', 'item-1');

    await local.applyPage('store-1', [item, sale], next);
    await local.applyPage('store-1', [sale, item], next);

    expect(await database?.sales.get('sale-1')).toMatchObject({ total: 150, paymentMethod: 'cash' });
    expect(await database?.saleItems.where('saleId').equals('sale-1').count()).toBe(1);
  });
});