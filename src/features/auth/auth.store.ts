import { create } from 'zustand';
import type { Permission, UserRole } from '@/types';
import type { AuthResolution, AuthState } from './auth.types';
import { authService } from './auth.service';
import { hasRolePermission } from './permissions';
import { setAuthenticatedRepositoryContext } from '@/repositories/repositoryContext';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function resolutionState(resolution: AuthResolution): Partial<AuthState> {
  if (resolution.status === 'unauthenticated') {
    setAuthenticatedRepositoryContext(null);
    return {
      user: null,
      pendingIdentity: null,
      memberships: [],
      status: 'unauthenticated',
      sessionMode: null,
    };
  }

  if (resolution.status === 'selecting-store') {
    setAuthenticatedRepositoryContext(null);
    return {
      user: null,
      pendingIdentity: resolution.identity,
      memberships: resolution.memberships,
      status: 'selecting-store',
      sessionMode: 'online',
    };
  }

  setAuthenticatedRepositoryContext({
    storeId: resolution.user.storeId,
    deviceId: resolution.user.deviceId,
    updatedBy: resolution.user.id,
  });
  return {
    user: resolution.user,
    pendingIdentity: null,
    memberships: resolution.memberships,
    status: resolution.status,
    sessionMode: resolution.status === 'offline' ? 'offline' : 'online',
  };
}

let initializationPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  const refreshSession = async () => {
    set({ status: 'loading', error: null });
    try {
      const resolution = await authService.restoreSession();
      set({
        ...resolutionState(resolution),
        error: null,
        notice: resolution.status === 'offline'
          ? 'Working offline using the last verified account session.'
          : null,
      });
    } catch (error) {
      setAuthenticatedRepositoryContext(null);
      set({
        user: null,
        pendingIdentity: null,
        memberships: [],
        status: 'unauthenticated',
        sessionMode: null,
        error: getErrorMessage(error, 'Session restoration failed.'),
      });
    }
  };

  return {
    user: null,
    profile: null,
    pendingIdentity: null,
    memberships: [],
    status: 'loading',
    sessionMode: null,
    error: null,
    notice: null,

    initialize: async () => {
      if (!initializationPromise) {
        initializationPromise = refreshSession().finally(() => {
          initializationPromise = null;
        });
      }
      await initializationPromise;
    },

    login: async (credentials) => {
      set({ status: 'loading', error: null, notice: null });
      try {
        const resolution = await authService.login(credentials);
        set({ ...resolutionState(resolution), error: null });
      } catch (error) {
        setAuthenticatedRepositoryContext(null);
        set({ user: null, pendingIdentity: null, memberships: [], status: 'unauthenticated', sessionMode: null, error: getErrorMessage(error, 'Login failed') });
        throw error;
      }
    },

    loginDevelopment: async (role: UserRole) => {
      set({ status: 'loading', error: null, notice: null });
      try {
        const resolution = await authService.loginDevelopment(role);
        set({
          ...resolutionState(resolution),
          sessionMode: 'development',
          error: null,
          notice: 'Development quick access is active. This is not a cloud account.',
        });
      } catch (error) {
        setAuthenticatedRepositoryContext(null);
        set({ user: null, pendingIdentity: null, memberships: [], status: 'unauthenticated', sessionMode: null, error: getErrorMessage(error, 'Development login failed') });
        throw error;
      }
    },

    signup: async (details) => {
      set({ status: 'loading', error: null, notice: null });
      try {
        const result = await authService.signup(details);
        if (result.resolution) {
          set({ ...resolutionState(result.resolution), error: null });
        } else {
          setAuthenticatedRepositoryContext(null);
          set({
            status: 'unauthenticated',
            error: null,
            notice: 'Check your email to confirm the account before signing in.',
          });
        }
        return result;
      } catch (error) {
        setAuthenticatedRepositoryContext(null);
        set({ user: null, pendingIdentity: null, memberships: [], status: 'unauthenticated', sessionMode: null, error: getErrorMessage(error, 'Signup failed') });
        throw error;
      }
    },

    requestPasswordReset: async (email) => {
      try {
        await authService.requestPasswordReset(email);
        set({ notice: 'If the account exists, a password-reset email has been sent.', error: null });
      } catch (error) {
        set({ error: getErrorMessage(error, 'Password reset request failed') });
        throw error;
      }
    },

    updatePassword: async (password) => {
      try {
        await authService.updatePassword(password);
        set({ notice: 'Password updated. You can continue using your account.', error: null });
      } catch (error) {
        set({ error: getErrorMessage(error, 'Password update failed') });
        throw error;
      }
    },

    selectStore: async (storeId) => {
      const { pendingIdentity, memberships } = get();
      if (!pendingIdentity) throw new Error('No account is waiting for store selection.');
      set({ status: 'loading', error: null });
      try {
        const resolution = await authService.selectStore(pendingIdentity, memberships, storeId);
        set({ ...resolutionState(resolution), error: null });
      } catch (error) {
        set({ status: 'selecting-store', error: getErrorMessage(error, 'Store selection failed') });
        throw error;
      }
    },

    logout: async () => {
      set({ status: 'loading', error: null });
      await authService.logout();
      setAuthenticatedRepositoryContext(null);
      set({
        user: null,
        profile: null,
        pendingIdentity: null,
        memberships: [],
        status: 'unauthenticated',
        sessionMode: null,
        error: null,
        notice: null,
      });
    },

    refreshProfile: refreshSession,

    hasPermission: (permission: Permission) => {
      const user = get().user;
      return user ? hasRolePermission(user.role, permission) : false;
    },
  };
});
