import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Cloud, Laptop, ShieldAlert } from 'lucide-react';
import { db } from '@/db/database';
import { conflictRepository } from '@/sync/ConflictRepository';
import type { ConflictResolution, SyncConflict } from '@/domain/sync/sync.types';
import { useAuthStore } from '@/features/auth/auth.store';
import { useToast } from '@/components/ui/Toast';

const protectedTypes = new Set(['sale_transaction','sale_compensation','sales','stock_movements','inventory_movement','utang_entries','gcash_transactions','payroll_entries','vault_transactions']);
const json = (value: unknown) => JSON.stringify(value, null, 2);

function VersionCard({ title, icon, value, version, editor, device, time }: { title:string; icon:React.ReactNode; value:unknown; version?:number; editor?:string|null; device?:string; time?:string }) {
  return <section className="min-w-0 rounded-lg border border-border bg-white p-3">
    <div className="mb-2 flex items-center gap-2 font-semibold">{icon}{title}</div>
    <dl className="mb-2 grid grid-cols-2 gap-x-2 text-xs text-muted-foreground"><dt>Version</dt><dd>{version ?? 'Unknown'}</dd><dt>Editor</dt><dd className="truncate">{editor || 'Unknown'}</dd><dt>Device</dt><dd className="truncate">{device || 'Unknown'}</dd><dt>Updated</dt><dd>{time ? new Date(time).toLocaleString() : 'Unknown'}</dd></dl>
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{json(value)}</pre>
  </section>;
}

export function Conflicts() {
  const conflicts = useLiveQuery(() => db.syncConflicts.filter((item) => !item.resolved).toArray().then((items) => items.sort((a,b) => b.detectedAt.localeCompare(a.detectedAt))), []) ?? [];
  const user = useAuthStore((state) => state.user);
  const { showToast } = useToast();
  const resolve = async (conflict: SyncConflict, resolution: ConflictResolution) => {
    if (conflict.id === undefined || !user) return;
    try { await conflictRepository.resolve(conflict.id, resolution, user.id); showToast('Conflict resolved and audited.', 'success'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Conflict resolution failed.', 'error'); }
  };
  return <div className="space-y-5">
    <div><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldAlert className="h-5 w-5"/>Sync conflicts</h2><p className="mt-1 text-sm text-muted-foreground">Review independent edits before synchronization continues. No choice is applied silently.</p></div>
    {!conflicts.length && <div className="rounded-xl border border-border bg-white p-8 text-center text-muted-foreground">No unresolved conflicts.</div>}
    {conflicts.map((conflict) => {
      const isProtected = protectedTypes.has(conflict.entityType);
      return <article key={conflict.id} className="rounded-xl border border-amber-300 bg-amber-50/40 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{conflict.entityType} · {conflict.entityId}</h3><p className="text-xs text-muted-foreground">Detected {new Date(conflict.detectedAt).toLocaleString()} · base version {conflict.baseVersion ?? 'unknown'}</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Needs review</span></div>
        <div className="grid gap-3 xl:grid-cols-3">
          <VersionCard title="Base" icon={<AlertTriangle className="h-4 w-4"/>} value={conflict.basePayload ?? 'Base snapshot unavailable'} version={conflict.baseVersion ?? undefined}/>
          <VersionCard title="This device" icon={<Laptop className="h-4 w-4"/>} value={conflict.localPayload} version={conflict.localVersion} editor={conflict.localEditor} device={conflict.localDevice} time={conflict.localUpdatedAt}/>
          <VersionCard title="Cloud" icon={<Cloud className="h-4 w-4"/>} value={conflict.remotePayload} version={conflict.serverVersion} editor={conflict.remoteEditor} device={conflict.remoteDevice} time={conflict.remoteUpdatedAt}/>
        </div>
        {isProtected ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>Protected ledger record.</strong> It cannot be overwritten here. Create a compensating transaction or adjustment in the source module; the original record remains intact.</div> : <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void resolve(conflict,'keep-local')} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary">Keep this device</button><button onClick={() => void resolve(conflict,'keep-cloud')} className="rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold">Keep cloud</button><button disabled title="Automatic merge requires a stored base snapshot" className="rounded-md border border-border px-3 py-2 text-sm font-semibold opacity-50">Merge fields</button></div>}
      </article>;
    })}
  </div>;
}