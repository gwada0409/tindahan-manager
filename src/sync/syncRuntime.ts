import { db } from '@/db/database';
import { useAuthStore } from '@/features/auth/auth.store';
import { supabase } from '@/lib/supabase';
import { SupabaseSyncAdapter } from './SupabaseSyncAdapter';
import { SyncEngine } from './SyncEngine';
import { SyncQueueRepository } from './SyncQueueRepository';
import { LocalPullRepository } from './LocalPullRepository';
import { PullSyncService } from './PullSyncService';

export const syncEngine = supabase ? new SyncEngine(
  new SyncQueueRepository(db),
  new SupabaseSyncAdapter(supabase),
  () => {
    const state=useAuthStore.getState();
    return state.user ? {storeId:state.user.storeId,userId:state.user.id,deviceId:state.user.deviceId,onlineSession:state.status==='authenticated'&&state.sessionMode==='online'} : null;
  },
  new PullSyncService(new LocalPullRepository(db),new SupabaseSyncAdapter(supabase)),
) : null;