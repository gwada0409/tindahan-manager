import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultRepositoryContext, setAuthenticatedRepositoryContext } from './repositoryContext';

describe('repository context', () => {
  afterEach(() => setAuthenticatedRepositoryContext(null));

  it('uses the verified authenticated store even when local store settings are absent', async () => {
    setAuthenticatedRepositoryContext({
      storeId: 'cloud-store',
      deviceId: 'mobile-device',
      updatedBy: 'user-1',
    });

    await expect(getDefaultRepositoryContext()).resolves.toEqual({
      storeId: 'cloud-store',
      deviceId: 'mobile-device',
      updatedBy: 'user-1',
    });
  });
});
