import { create } from 'zustand';
import { AuthState, LoginCredentials } from './auth.types';
import { authService } from './auth.service';
import { hasRolePermission } from './permissions';
import { Permission } from '@/types';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  status: 'loading',
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ status: 'loading', error: null });
    try {
      const user = await authService.login(credentials);
      set({ user, status: 'authenticated', error: null });
    } catch (err: any) {
      set({ status: 'unauthenticated', error: err.message || 'Login failed' });
      throw err;
    }
  },

  logout: async () => {
    set({ status: 'loading' });
    await authService.logout();
    set({ user: null, profile: null, status: 'unauthenticated', error: null });
  },

  refreshProfile: async () => {
    set({ status: 'loading' });
    try {
      const user = await authService.getSession();
      if (user) {
        set({ user, status: 'authenticated', error: null });
      } else {
        set({ user: null, status: 'unauthenticated', error: null });
      }
    } catch (err) {
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  hasPermission: (permission: Permission) => {
    const user = get().user;
    if (!user) return false;
    return hasRolePermission(user.role, permission);
  }
}));
