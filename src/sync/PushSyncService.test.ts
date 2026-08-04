import { describe, expect, it, vi } from 'vitest';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { PushSyncService } from './PushSyncService';
import { SyncEngine } from './SyncEngine';
import type { SyncQueueRepository } from './SyncQueueRepository';
import type { SyncAdapter } from './syncTypes';

const item=(operationId:string,entityType='products'):SyncQueueItem=>({queueId:1,operationId,storeId:'store-1',entityType,entityId:'entity-1',operation:'upsert',payload:{},createdAt:'2026-01-01T00:00:00.000Z',attempts:0,status:'pending'});

describe('push synchronization',()=>{
  it('acknowledges only server-confirmed operations and retains partial failures',async()=>{
    const first=item('op-1','products'); const second={...item('op-2','customers'),queueId:2};
    const acknowledge=vi.fn(); const markFailed=vi.fn();
    const queue={ready:vi.fn().mockResolvedValue([first,second]),markProcessing:vi.fn(),acknowledge,markFailed} as unknown as SyncQueueRepository;
    const adapter:SyncAdapter={verifySession:vi.fn(),isReachable:vi.fn(),push:vi.fn().mockResolvedValue([{operationId:'op-1',status:'processed',duplicate:true},{operationId:'op-2',status:'failed',error:'conflict'}]),pull:vi.fn()};
    const result=await new PushSyncService(queue,adapter).pushReady('store-1');
    expect(result).toEqual({attempted:2,processed:1,failed:1});
    expect(acknowledge).toHaveBeenCalledWith(first);
    expect(markFailed).toHaveBeenCalledWith(second,'conflict');
  });

  it('retains every claimed operation when the request fails',async()=>{
    const pending=item('op-network'); const markFailed=vi.fn();
    const queue={ready:vi.fn().mockResolvedValue([pending]),markProcessing:vi.fn(),acknowledge:vi.fn(),markFailed} as unknown as SyncQueueRepository;
    const adapter:SyncAdapter={verifySession:vi.fn(),isReachable:vi.fn(),push:vi.fn().mockRejectedValue(new Error('timeout')),pull:vi.fn()};
    expect(await new PushSyncService(queue,adapter).pushReady('store-1')).toEqual({attempted:1,processed:0,failed:1});
    expect(markFailed).toHaveBeenCalledWith(pending,expect.any(Error));
  });

  it('checks session and reachability before recovery and upload',async()=>{
    const order:string[]=[];
    const queue={count:vi.fn().mockResolvedValue(1),retryFailed:vi.fn(async()=>{order.push('manual-retry');return 0;}),recover:vi.fn(async()=>{order.push('recover');return 0;}),adoptUnassignedChanges:vi.fn(async()=>{order.push('adopt');return 0;}),repairLegacyProductReferences:vi.fn(async()=>{order.push('repair');return 0;}),ready:vi.fn(async()=>{order.push('ready');return [];}),markProcessing:vi.fn(),acknowledge:vi.fn(),markFailed:vi.fn()} as unknown as SyncQueueRepository;
    const adapter:SyncAdapter={verifySession:vi.fn(async()=>{order.push('session');return true;}),isReachable:vi.fn(async()=>{order.push('reachability');return true;}),push:vi.fn(),pull:vi.fn()};
    const engine=new SyncEngine(queue,adapter,()=>({storeId:'store-1',userId:'user-1',deviceId:'device-1',onlineSession:true}));
    expect(await engine.run('manual')).toMatchObject({attempted:0,processed:0,failed:0});
    expect(order).toEqual(['session','reachability','manual-retry','recover','adopt','repair','ready']);
  });

  it('keeps interval checks local while idle and refreshes after the stale threshold',async()=>{
    const queue={count:vi.fn().mockResolvedValue(0)} as unknown as SyncQueueRepository;
    const adapter={} as SyncAdapter;
    const engine=new SyncEngine(queue,adapter,()=>null);
    (engine as unknown as {snapshot:{lastSuccessfulSyncAt?:string}}).snapshot={lastSuccessfulSyncAt:'2026-01-01T00:00:00.000Z'};
    expect(await engine.shouldRunPeriodic('store-1',Date.parse('2026-01-01T00:14:00.000Z'))).toBe(false);
    expect(await engine.shouldRunPeriodic('store-1',Date.parse('2026-01-01T00:15:00.000Z'))).toBe(true);
    (queue.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    expect(await engine.shouldRunPeriodic('store-1',Date.parse('2026-01-01T00:01:00.000Z'))).toBe(true);
  });
  it('never throws into local application flow when cloud verification fails',async()=>{
    const queue={count:vi.fn().mockResolvedValue(2)} as unknown as SyncQueueRepository;
    const adapter:SyncAdapter={verifySession:vi.fn().mockRejectedValue(new Error('outage')),isReachable:vi.fn(),push:vi.fn(),pull:vi.fn()};
    const engine=new SyncEngine(queue,adapter,()=>({storeId:'store-1',userId:'user-1',deviceId:'device-1',onlineSession:true}));
    await expect(engine.run('interval')).resolves.toMatchObject({failed:0,skippedReason:'Synchronization failed safely.'});
  });
});
