import { describe,expect,it } from 'vitest';
import { deriveDisplaySyncState } from './SyncStatusIndicator';
const snapshot=(activity:'idle'|'syncing'|'offline'|'error'|'success',pending=0)=>({activity,pending});
describe('sync status presentation',()=>{
 it.each([
  [{online:false,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('idle')},'offline'],
  [{online:true,configured:true,authenticated:false,conflicts:0,snapshot:snapshot('idle')},'auth-required'],
  [{online:true,configured:false,authenticated:true,conflicts:0,snapshot:snapshot('idle')},'cloud-unavailable'],
  [{online:true,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('syncing')},'syncing'],
  [{online:true,configured:true,authenticated:true,conflicts:1,snapshot:snapshot('idle')},'conflict'],
  [{online:true,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('error')},'failed'],
  [{online:true,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('offline')},'cloud-unavailable'],
  [{online:true,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('idle',3)},'pending'],
  [{online:true,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('success')},'synced'],
  [{online:true,configured:true,authenticated:true,conflicts:0,snapshot:snapshot('idle')},'online'],
 ] as const)('maps runtime evidence to %s', (input,expected)=>expect(deriveDisplaySyncState(input)).toBe(expected));
});