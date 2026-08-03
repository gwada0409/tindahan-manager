export const LOCAL_SYNC_MUTATION_EVENT = 'tindahan:local-sync-mutation';
export function notifyLocalSyncMutation(): void {
  if (typeof globalThis.dispatchEvent === 'function' && typeof Event === 'function') globalThis.dispatchEvent(new Event(LOCAL_SYNC_MUTATION_EVENT));
}