import { UserRole, UserProfile, Permission } from '@/types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  employeeId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthState {
  user: AuthenticatedUser | null;
  profile: UserProfile | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}
