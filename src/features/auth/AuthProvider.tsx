import { useEffect, type ReactNode } from 'react';
import { authService } from './auth.service';
import { useAuthStore } from './auth.store';
import { SyncLifecycle } from '@/sync/SyncLifecycle';

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
    return authService.onAuthStateChange(() => {
      void useAuthStore.getState().refreshProfile();
    });
  }, [initialize]);

  return <><SyncLifecycle />{children}</>;
}
