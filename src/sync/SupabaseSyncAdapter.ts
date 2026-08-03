import type { SupabaseClient } from '@supabase/supabase-js';
import type { PullCursor, SyncQueueItem } from '@/domain/sync/sync.types';
import type { Database, Json } from '@/types/supabase.database';
import { checkAuthenticatedReachability } from './connectivityCheck';
import type { PullChange, PullEntityType, PullPage, PushResult, SyncAdapter } from './syncTypes';

function parseResults(value: Json): PushResult[] {
  if (!Array.isArray(value)) throw new Error('Sync endpoint returned an invalid response.');
  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return [];
    const operationId = item.operationId;
    const status = item.status;
    if (typeof operationId !== 'string' || (status !== 'processed' && status !== 'failed')) return [];
    return [{ operationId, status, duplicate: item.duplicate === true, errorCode: typeof item.errorCode === 'string' ? item.errorCode : undefined, error: typeof item.error === 'string' ? item.error : undefined }];
  });
}


const pullEntityTypes = new Set<PullEntityType>(['product_categories','suppliers','products','customers','inventory_batches','stock_movements','utang_entries','gcash_transactions','bills','employees','payroll_entries','vault_transactions']);
function parsePullPage(value: Json): PullPage {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Pull endpoint returned an invalid response.');
  const cursor=value.nextCursor;
  if (!cursor || Array.isArray(cursor) || typeof cursor !== 'object' || typeof cursor.changedAt !== 'string' || typeof cursor.id !== 'string') throw new Error('Pull endpoint returned an invalid cursor.');
  if (!Array.isArray(value.changes)) throw new Error('Pull endpoint returned invalid changes.');
  const changes:PullChange[]=value.changes.map((item)=>{
    if(!item||Array.isArray(item)||typeof item!=='object'||typeof item.entityType!=='string'||!pullEntityTypes.has(item.entityType as PullEntityType)||typeof item.changedAt!=='string'||!item.record||Array.isArray(item.record)||typeof item.record!=='object') throw new Error('Pull endpoint returned an invalid change.');
    return {entityType:item.entityType as PullEntityType,changedAt:item.changedAt,record:item.record as Record<string,unknown>};
  });
  return {changes,nextCursor:{changedAt:cursor.changedAt,id:cursor.id},hasMore:value.hasMore===true};
}
export class SupabaseSyncAdapter implements SyncAdapter {
  private readonly client: SupabaseClient<Database>;
  constructor(client: SupabaseClient<Database>) { this.client = client; }
  async verifySession(): Promise<boolean> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) return false;
    const { data: verified, error: verifyError } = await this.client.auth.getUser();
    return !verifyError && Boolean(verified.user);
  }
  isReachable(storeId: string, timeoutMs?: number): Promise<boolean> { return checkAuthenticatedReachability(this.client, storeId, timeoutMs); }
  async push(operations: SyncQueueItem[]): Promise<PushResult[]> {
    const masterOperations=operations.filter((item)=>!['sale_transaction','sale_compensation','inventory_restock','inventory_movement','utang_entries','gcash_transactions','bills','employees','payroll_entries','vault_transactions'].includes(item.entityType));
    const saleOperations=operations.filter((item)=>item.entityType==='sale_transaction');
    const results:PushResult[]=[];
    if(masterOperations.length){
      const {data,error}=await this.client.rpc('process_sync_operations',{p_operations:masterOperations as unknown as Json});
      if(error)throw new Error(`Push request failed (${error.code??'unknown'}).`);
      results.push(...parseResults(data));
    }
    for(const operation of saleOperations){
      const {data,error}=await this.client.rpc('process_sale_transaction',{p_operation:operation as unknown as Json});
      if(error){results.push({operationId:operation.operationId,status:'failed',errorCode:error.code,error:`Sale transaction failed (${error.code??'unknown'}).`});continue;}
      results.push(...parseResults([data] as unknown as Json));
    }
    for(const operation of operations.filter((item)=>['utang_entries','gcash_transactions','bills','employees','payroll_entries','vault_transactions'].includes(item.entityType))){
      const {data,error}=await this.client.rpc('process_financial_operation',{p_operation:operation as unknown as Json});
      if(error){results.push({operationId:operation.operationId,status:'failed',errorCode:error.code,error:'Financial operation failed ('+(error.code??'unknown')+').'});continue;}
      results.push(...parseResults([data] as unknown as Json));
    }    for(const operation of operations.filter((item)=>item.entityType==='inventory_restock'||item.entityType==='inventory_movement')){
      const {data,error}=await this.client.rpc('process_inventory_operation',{p_operation:operation as unknown as Json});
      if(error){results.push({operationId:operation.operationId,status:'failed',errorCode:error.code,error:'Inventory operation failed ('+(error.code??'unknown')+').'});continue;}
      results.push(...parseResults([data] as unknown as Json));
    }    for(const operation of operations.filter((item)=>item.entityType==='sale_compensation')){
      const {data,error}=await this.client.rpc('process_sale_compensation',{p_operation:operation as unknown as Json});
      if(error){results.push({operationId:operation.operationId,status:'failed',errorCode:error.code,error:'Sale compensation failed ('+(error.code??'unknown')+').'});continue;}
      results.push(...parseResults([data] as unknown as Json));
    }
    return results;
  }
  async cleanupReceipts(storeId: string): Promise<number> {
    const { data, error } = await this.client.rpc('cleanup_sync_receipts', { p_store_id: storeId, p_retention_days: 30, p_limit: 1000 });
    if (error) throw new Error(`Receipt cleanup failed (${error.code ?? 'unknown'}).`);
    return typeof data === 'number' ? data : 0;
  }  async recordDeviceSync(storeId: string, deviceId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client.from('devices').update({ last_seen_at: now, last_sync_at: now }).eq('store_id', storeId).eq('device_key', deviceId).is('revoked_at', null);
    if (error) throw new Error(`Device activity update failed (${error.code ?? 'unknown'}).`);
  }  async pull(storeId: string, cursor: PullCursor, limit: number): Promise<PullPage> {
    const { data, error } = await this.client.rpc('pull_sync_changes', { p_store_id: storeId, p_after_changed_at: cursor.changedAt, p_after_id: cursor.id, p_limit: limit });
    if (error) throw new Error(`Pull request failed (${error.code ?? 'unknown'}).`);
    return parsePullPage(data);
  }
}