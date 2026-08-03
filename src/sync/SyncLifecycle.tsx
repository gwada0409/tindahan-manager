import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { LOCAL_SYNC_MUTATION_EVENT } from './syncEvents';
import { syncEngine } from './syncRuntime';
import { supabase } from '@/lib/supabase';

export function SyncLifecycle() {
  const storeId=useAuthStore((state)=>state.user?.storeId);
  const online=useAuthStore((state)=>state.status==='authenticated'&&state.sessionMode==='online');
  useEffect(()=>{
    const engine=syncEngine;
    if(!engine||!storeId||!online)return;
    void engine.run('sign-in');
    const onOnline=()=>{void engine.run('online');};
    let debounce:ReturnType<typeof globalThis.setTimeout>|undefined;
    const onMutation=()=>{globalThis.clearTimeout(debounce); debounce=globalThis.setTimeout(()=>{void engine.run('mutation');},1500);};
    globalThis.addEventListener('online',onOnline);
    globalThis.addEventListener(LOCAL_SYNC_MUTATION_EVENT,onMutation);
    const interval=globalThis.setInterval(()=>{if(typeof document!=='undefined'&&document.visibilityState==='hidden')return;void engine.shouldRunPeriodic(storeId).then((needed)=>{if(needed)void engine.run('interval');});},60_000);
    let realtimeDebounce:ReturnType<typeof globalThis.setTimeout>|undefined;
    const realtimeTables=['product_categories','suppliers','products','customers','inventory_batches','stock_movements','sales','sale_items','utang_entries','gcash_transactions','bills','employees','payroll_entries','vault_transactions'];
    const channel=supabase?.channel(`store-sync:${storeId}`);
    const onRealtime=()=>{globalThis.clearTimeout(realtimeDebounce);realtimeDebounce=globalThis.setTimeout(()=>{void engine.run('realtime');},750);};
    for(const table of realtimeTables)channel?.on('postgres_changes',{event:'*',schema:'public',table,filter:`store_id=eq.${storeId}`},onRealtime);
    channel?.subscribe();
    return()=>{globalThis.removeEventListener('online',onOnline);globalThis.removeEventListener(LOCAL_SYNC_MUTATION_EVENT,onMutation);globalThis.clearInterval(interval);globalThis.clearTimeout(debounce);globalThis.clearTimeout(realtimeDebounce);if(channel&&supabase)void supabase.removeChannel(channel);};
  },[storeId,online]);
  return null;
}