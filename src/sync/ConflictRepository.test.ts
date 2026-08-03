import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TindahanDB } from '@/db/database';
import { ConflictRepository } from './ConflictRepository';

const metadata = { storeId:'store-1', createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-02T00:00:00Z', deletedAt:null, version:2, baseVersion:1, updatedBy:'user-1', deviceId:'device-1', syncStatus:'conflict' as const };
describe('conflict resolution', () => {
 let database:TindahanDB|undefined;
 afterEach(async()=>{if(database){const name=database.name;database.close();await Dexie.delete(name);database=undefined;}});
 async function setup(){database=new TindahanDB(`conflict-${crypto.randomUUID()}`);await database.open();return new ConflictRepository(database);}
 it('keeps cloud explicitly, clears queued edits, and audits the choice',async()=>{
  const repository=await setup();const local={id:'cat-1',name:'Local',sync:metadata};const remote={id:'cat-1',name:'Cloud',sync:{...metadata,version:3,baseVersion:null,syncStatus:'synced' as const}};
  await database!.categories.put(local);await database!.syncQueue.add({operationId:'op-1',storeId:'store-1',entityType:'product_categories',entityId:'cat-1',operation:'upsert',payload:local,createdAt:new Date().toISOString(),attempts:0,status:'pending'});
  const id=await repository.record({storeId:'store-1',entityType:'product_categories',entityId:'cat-1',detectedAt:new Date().toISOString(),localPayload:local,remotePayload:remote,localVersion:2,serverVersion:3});
  await repository.resolve(id,'keep-cloud','admin-1');
  expect((await database!.categories.get('cat-1'))?.name).toBe('Cloud');expect(await database!.syncQueue.count()).toBe(0);expect((await database!.syncConflicts.get(id))?.resolved).toBe(true);expect((await database!.auditLogs.toArray())[0]?.action).toBe('resolve_sync_conflict');
 });
 it('rejects overwriting protected financial records',async()=>{
  const repository=await setup();const id=await repository.record({storeId:'store-1',entityType:'utang_entries',entityId:'u-1',detectedAt:new Date().toISOString(),localPayload:{id:'u-1'},remotePayload:{id:'u-1'}});
  await expect(repository.resolve(id,'keep-cloud','admin-1')).rejects.toThrow('cannot be overwritten');expect((await database!.syncConflicts.get(id))?.resolved).toBe(false);
 });
});