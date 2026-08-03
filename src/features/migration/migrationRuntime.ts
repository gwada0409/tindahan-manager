import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { SupabaseSyncAdapter } from '@/sync/SupabaseSyncAdapter';
import { syncEngine } from '@/sync/syncRuntime';
import { InitialMigrationService } from './initialMigration.service';
export const initialMigrationService=new InitialMigrationService(db,supabase?new SupabaseSyncAdapter(supabase):undefined);
export async function runInitialMigrationSync(){if(!syncEngine)throw new Error('Cloud synchronization is unavailable.');return syncEngine.run('manual');}