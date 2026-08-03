import { UserRole, UserProfile, Permission } from '@/types';

export type StoreMembershipRole = 'owner' | 'administrator' | 'cashier' | 'staff';
export type AuthSessionMode = 'online' | 'offline' | 'development';

export interface StoreMembership {
  storeId: string;
  storeName: string;
  role: StoreMembershipRole;
}

export interface BasicAuthIdentity {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  membershipRole: StoreMembershipRole;
  storeId: string;
  storeName: string;
  deviceId: string;
  lastVerifiedAt: string;
  employeeId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupDetails {
  email: string;
  password: string;
  displayName: string;
  storeName: string;
}

export interface SignupResult {
  requiresEmailConfirmation: boolean;
  resolution: AuthResolution | null;
}

export type AuthResolution =
  | { status: 'unauthenticated' }
  | {
      status: 'authenticated' | 'offline';
      user: AuthenticatedUser;
      memberships: StoreMembership[];
    }
  | {
      status: 'selecting-store';
      identity: BasicAuthIdentity;
      memberships: StoreMembership[];
    };

export interface AuthState {
  user: AuthenticatedUser | null;
  profile: UserProfile | null;
  pendingIdentity: BasicAuthIdentity | null;
  memberships: StoreMembership[];
  status: 'loading' | 'authenticated' | 'offline' | 'selecting-store' | 'unauthenticated';
  sessionMode: AuthSessionMode | null;
  error: string | null;
  notice: string | null;
  initialize: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginDevelopment: (role: UserRole) => Promise<void>;
  signup: (details: SignupDetails) => Promise<SignupResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  selectStore: (storeId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}
