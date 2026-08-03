import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.database';

export async function checkAuthenticatedReachability(client: SupabaseClient<Database>, storeId: string, timeoutMs = 8_000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return false;
    const { error } = await client.from('store_members').select('id').eq('store_id', storeId).eq('user_id', userData.user.id).eq('active', true).limit(1).abortSignal(controller.signal);
    return !error;
  } catch { return false; }
  finally { globalThis.clearTimeout(timeout); }
}