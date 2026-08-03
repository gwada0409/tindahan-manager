import type { SyncAdapter } from './syncTypes';
import { LocalPullRepository } from './LocalPullRepository';
export class PullSyncService {
  private readonly local:LocalPullRepository;private readonly adapter:SyncAdapter;private readonly pageSize:number;
  constructor(local:LocalPullRepository,adapter:SyncAdapter,pageSize=100){this.local=local;this.adapter=adapter;this.pageSize=pageSize;}
  async pullAll(storeId:string):Promise<number>{let cursor=await this.local.cursor(storeId);let pulled=0;for(let pageNumber=0;pageNumber<100;pageNumber++){const page=await this.adapter.pull(storeId,cursor,this.pageSize);await this.local.applyPage(storeId,page.changes,page.nextCursor);pulled+=page.changes.length;cursor=page.nextCursor;if(!page.hasMore){await this.local.markSuccessful(storeId,cursor);return pulled;}}throw new Error('Pull pagination safety limit exceeded.');}
}