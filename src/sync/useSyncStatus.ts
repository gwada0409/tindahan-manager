import { useSyncExternalStore } from 'react';
import { syncEngine } from './syncRuntime';
import type { SyncStatusSnapshot } from './syncTypes';
const unavailable:SyncStatusSnapshot={activity:'offline',pending:0,message:'Cloud sync is unavailable.'};
export function useSyncStatus():SyncStatusSnapshot{return useSyncExternalStore((listener)=>syncEngine?.subscribe(listener)??(()=>{}),()=>syncEngine?.getSnapshot()??unavailable,()=>unavailable);}