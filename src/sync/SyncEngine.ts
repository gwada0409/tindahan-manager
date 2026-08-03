import { PushSyncService } from './PushSyncService';
import { SyncQueueRepository } from './SyncQueueRepository';
import type { LocalSyncContext, SyncAdapter, SyncRunReason, SyncStatusSnapshot, SyncSummary } from './syncTypes';
import { PullSyncService } from './PullSyncService';

export type SyncContextProvider = () => LocalSyncContext | null;
export class SyncEngine {
  private active: Promise<SyncSummary> | null = null;
  private lastReceiptCleanupAt = 0;
  private snapshot: SyncStatusSnapshot = { activity: 'idle', pending: 0 };
  private readonly listeners = new Set<(value: SyncStatusSnapshot)=>void>();
  private readonly queue:SyncQueueRepository; private readonly adapter:SyncAdapter; private readonly contextProvider:SyncContextProvider; private readonly pullService?:PullSyncService;
  constructor(queue: SyncQueueRepository, adapter: SyncAdapter, contextProvider: SyncContextProvider, pullService?:PullSyncService) {this.queue=queue;this.adapter=adapter;this.contextProvider=contextProvider;this.pullService=pullService;}
  subscribe(listener:(value:SyncStatusSnapshot)=>void):()=>void { this.listeners.add(listener); listener(this.snapshot); return ()=>this.listeners.delete(listener); }
  getSnapshot():SyncStatusSnapshot{return this.snapshot;}
  private publish(value:SyncStatusSnapshot){this.snapshot=value; for(const listener of this.listeners) listener(value);}
  async shouldRunPeriodic(storeId:string,now=Date.now(),maxIdleMs=15*60_000):Promise<boolean>{
    if(await this.queue.count(storeId)>0)return true;
    const last=this.snapshot.lastSuccessfulSyncAt;
    return !last||!Number.isFinite(Date.parse(last))||now-Date.parse(last)>=maxIdleMs;
  }  run(reason: SyncRunReason): Promise<SyncSummary> {
    if(this.active) return this.active;
    this.active=this.execute(reason).finally(()=>{this.active=null;});
    return this.active;
  }
  private async execute(reason:SyncRunReason):Promise<SyncSummary>{
    const context=this.contextProvider();
    if(!context?.storeId || !context.onlineSession){const result={attempted:0,processed:0,failed:0,pulled:0,skippedReason:'Authentication required for cloud sync.'};this.publish({...this.snapshot,activity:'offline',lastResult:result,message:result.skippedReason});return result;}
    this.publish({activity:'syncing',pending:await this.queue.count(context.storeId),message:`Sync started: ${reason}`});
    try {
      if(!await this.adapter.verifySession()){const now=new Date().toISOString();const result={attempted:0,processed:0,failed:0,pulled:0,skippedReason:'Authentication required. Sign in online to resume cloud sync.'}; this.publish({...this.snapshot,activity:'offline',pending:await this.queue.count(context.storeId),lastResult:result,message:result.skippedReason,lastConnectivityCheckAt:now}); return result;}
      const connectivityCheckedAt=new Date().toISOString();
      if(!await this.adapter.isReachable(context.storeId)){const result={attempted:0,processed:0,failed:0,pulled:0,skippedReason:'Cloud connection is temporarily unavailable. Your work remains saved on this device.'}; this.publish({...this.snapshot,activity:'offline',pending:await this.queue.count(context.storeId),lastResult:result,message:result.skippedReason,lastConnectivityCheckAt:connectivityCheckedAt}); return result;}
      await this.queue.recover();
      const push=await new PushSyncService(this.queue,this.adapter).pushReady(context.storeId);
      const lastPushAt=new Date().toISOString();
      const pulled=this.pullService?await this.pullService.pullAll(context.storeId):0;
      const lastPullAt=new Date().toISOString();
      const result:SyncSummary={...push,pulled};
      if(!result.failed&&this.adapter.recordDeviceSync){try{await this.adapter.recordDeviceSync(context.storeId,context.deviceId);}catch{console.warn('[Sync] Device activity timestamp could not be updated.');}}
      if(!result.failed&&this.adapter.cleanupReceipts&&Date.now()-this.lastReceiptCleanupAt>=24*60*60_000){this.lastReceiptCleanupAt=Date.now();try{await this.adapter.cleanupReceipts(context.storeId);}catch{console.warn('[Sync] Receipt retention cleanup could not be completed.');}}
      const successfulAt=result.failed?this.snapshot.lastSuccessfulSyncAt:lastPullAt;
      this.publish({activity:result.failed?'error':'success',pending:await this.queue.count(context.storeId),lastResult:result,message:result.failed?'Some changes remain queued.':'Synchronization complete: '+pulled+' downloaded.',lastConnectivityCheckAt:connectivityCheckedAt,lastPushAt,lastPullAt,lastSuccessfulSyncAt:successfulAt});
      console.info('[Sync]',{reason,attempted:result.attempted,processed:result.processed,failed:result.failed,pulled});
      return result;
    } catch(error){const result={attempted:0,processed:0,failed:0,pulled:0,skippedReason:'Synchronization failed safely.'}; this.publish({...this.snapshot,activity:'error',pending:await this.queue.count(context.storeId),lastResult:result,message:result.skippedReason}); console.warn('[Sync]',{reason,error:error instanceof Error?error.name:'UnknownError'}); return result;}
  }
}