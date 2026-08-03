import { db } from '@/db/database';
import { UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';

export interface RepositoryContext {
  storeId: string;
  deviceId: string;
  updatedBy: string | null;
}

export type RepositoryContextProvider = () => Promise<RepositoryContext>;

let authenticatedContext: RepositoryContext | null = null;

export function setAuthenticatedRepositoryContext(context: RepositoryContext | null): void {
  authenticatedContext = context;
}

export const getDefaultRepositoryContext: RepositoryContextProvider = async () => {
  if (authenticatedContext) return authenticatedContext;
  const store = await db.storeSettings.toCollection().first();

  return {
    storeId: store?.id ?? UNASSIGNED_LOCAL_STORE_ID,
    deviceId: getOrCreateDeviceId(),
    updatedBy: null,
  };
};
