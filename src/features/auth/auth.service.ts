import type { User } from '@supabase/supabase-js';
import { db } from '@/db/database';
import { UserProfile, UserRole } from '@/types';
import { auditLogRepo, userProfileRepo } from '@/repositories/EntityRepositories';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import { AppError } from '@/shared/errors/AppError';
import { supabase } from '@/lib/supabase';
import type {
  AuthenticatedUser,
  AuthResolution,
  BasicAuthIdentity,
  LoginCredentials,
  SignupDetails,
  SignupResult,
  StoreMembership,
  StoreMembershipRole,
} from './auth.types';
import {
  cacheVerifiedIdentity,
  clearVerifiedIdentity,
  getVerifiedOfflineIdentity,
} from './offlineSession.service';
import { getAuthRedirectUrl } from './authRedirect';
import {
  type AuthBackend,
  SupabaseAuthBackend,
  toBasicIdentity,
} from './supabaseAuth.backend';

const LEGACY_SESSION_KEY = 'tindahan_auth_session';
const DEVELOPMENT_SESSION_KEY = 'tindahan_development_session';

export interface AuthServiceOptions {
  backend?: AuthBackend | null;
  allowDevelopmentAccess?: boolean;
}

function getStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function mapMembershipRole(role: StoreMembershipRole): UserRole {
  return role === 'owner' || role === 'administrator' ? 'admin' : 'employee';
}

function toAuthenticatedUser(
  identity: BasicAuthIdentity,
  membership: StoreMembership,
  lastVerifiedAt = new Date().toISOString(),
): AuthenticatedUser {
  return {
    ...identity,
    role: mapMembershipRole(membership.role),
    membershipRole: membership.role,
    storeId: membership.storeId,
    storeName: membership.storeName,
    deviceId: getOrCreateDeviceId(),
    lastVerifiedAt,
  };
}

function getMetadataStoreName(user: User): string | null {
  const value = user.user_metadata?.store_name;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export class AuthService {
  private readonly backend: AuthBackend | null;
  private readonly allowDevelopmentAccess: boolean;

  constructor(options: AuthServiceOptions = {}) {
    this.backend = options.backend === undefined
      ? supabase ? new SupabaseAuthBackend(supabase) : null
      : options.backend;
    this.allowDevelopmentAccess = options.allowDevelopmentAccess ?? import.meta.env.DEV;
  }

  get isCloudConfigured(): boolean {
    return this.backend !== null;
  }

  async ensureDefaultAccounts(): Promise<void> {
    const count = await userProfileRepo.count();
    if (count > 0) return;

    const now = new Date();
    await userProfileRepo.add({
      authUserId: 'admin-auth-id',
      displayName: 'Store Manager (Admin)',
      role: 'admin',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await userProfileRepo.add({
      authUserId: 'employee-auth-id',
      displayName: 'Store Staff (Employee)',
      role: 'employee',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async getOnlineResolution(user: User): Promise<AuthResolution> {
    let memberships = await this.backend!.listMemberships(user.id);
    if (memberships.length === 0) {
      const pendingStoreName = getMetadataStoreName(user);
      if (pendingStoreName) {
        memberships = await this.backend!.createOwnerStore(pendingStoreName);
      }
    }

    if (memberships.length === 0) {
      throw new AppError(
        'Your account does not have an active store membership.',
        'AUTH_MEMBERSHIP_REQUIRED',
      );
    }

    const identity = toBasicIdentity(user);
    const cached = getVerifiedOfflineIdentity();
    const preferred = cached?.id === identity.id
      ? memberships.find((membership) => membership.storeId === cached.storeId)
      : undefined;

    if (!preferred && memberships.length > 1) {
      return { status: 'selecting-store', identity, memberships };
    }

    return this.selectStore(identity, memberships, (preferred ?? memberships[0]).storeId);
  }

  async selectStore(
    identity: BasicAuthIdentity,
    memberships: StoreMembership[],
    storeId: string,
  ): Promise<AuthResolution> {
    if (!this.backend) {
      throw new AppError('Supabase is not configured.', 'AUTH_CONFIGURATION_REQUIRED');
    }

    const membership = memberships.find((candidate) => candidate.storeId === storeId);
    if (!membership) {
      throw new AppError('The selected store membership is not available.', 'AUTH_STORE_SELECTION_INVALID');
    }

    const user = toAuthenticatedUser(identity, membership);
    await this.backend.registerDevice(user.id, membership, user.deviceId);
    cacheVerifiedIdentity(user);
    await this.writeAudit('auth:verified', user, { storeId, membershipRole: membership.role });
    return { status: 'authenticated', user, memberships };
  }

  async login(credentials: LoginCredentials): Promise<AuthResolution> {
    if (!this.backend) {
      throw new AppError(
        'Supabase is not configured. Use development quick access locally or configure a project.',
        'AUTH_CONFIGURATION_REQUIRED',
      );
    }

    const session = await this.backend.signIn(
      credentials.email.trim().toLowerCase(),
      credentials.password,
    );
    return this.getOnlineResolution(session.user);
  }

  async signup(details: SignupDetails): Promise<SignupResult> {
    if (!this.backend) {
      throw new AppError('Supabase is required to create an account.', 'AUTH_CONFIGURATION_REQUIRED');
    }

    const result = await this.backend.signUp(
      {
        ...details,
        email: details.email.trim().toLowerCase(),
        displayName: details.displayName.trim(),
        storeName: details.storeName.trim(),
      },
      getAuthRedirectUrl('/login'),
    );

    if (!result.session) {
      return { requiresEmailConfirmation: true, resolution: null };
    }

    return {
      requiresEmailConfirmation: false,
      resolution: await this.getOnlineResolution(result.session.user),
    };
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!this.backend) {
      throw new AppError('Supabase is required for password recovery.', 'AUTH_CONFIGURATION_REQUIRED');
    }
    await this.backend.requestPasswordReset(
      email.trim().toLowerCase(),
      getAuthRedirectUrl('/reset-password'),
    );
  }

  async updatePassword(password: string): Promise<void> {
    if (!this.backend) {
      throw new AppError('Supabase is required to update a password.', 'AUTH_CONFIGURATION_REQUIRED');
    }
    await this.backend.updatePassword(password);
  }

  async restoreSession(): Promise<AuthResolution> {
    getStorage()?.removeItem(LEGACY_SESSION_KEY);

    if (!this.backend) {
      return this.restoreDevelopmentSession();
    }

    try {
      const session = await this.backend.getSession();
      if (session) {
        const verifiedUser = await this.backend.getVerifiedUser();
        if (!verifiedUser || verifiedUser.id !== session.user.id) {
          return { status: 'unauthenticated' };
        }
        return await this.getOnlineResolution(verifiedUser);
      }

      if (await this.backend.isReachable()) {
        return { status: 'unauthenticated' };
      }
    } catch (error) {
      if (await this.backend.isReachable()) throw error;
    }

    const offlineUser = getVerifiedOfflineIdentity();
    return offlineUser
      ? { status: 'offline', user: offlineUser, memberships: [] }
      : { status: 'unauthenticated' };
  }

  async loginDevelopment(role: UserRole): Promise<AuthResolution> {
    if (!this.allowDevelopmentAccess) {
      throw new AppError('Development quick access is disabled.', 'AUTH_DEVELOPMENT_DISABLED');
    }

    await this.ensureDefaultAccounts();
    const profile = (await userProfileRepo.list()).find(
      (candidate) => candidate.role === role && candidate.active,
    );
    const store = await db.storeSettings.toCollection().first();
    const identity: BasicAuthIdentity = {
      id: profile?.authUserId ?? `development-${role}`,
      email: `${role}@development.local`,
      displayName: profile?.displayName ?? `Development ${role}`,
    };
    const membership: StoreMembership = {
      storeId: store?.id ?? 'local-development-store',
      storeName: store?.name ?? 'Local development store',
      role: role === 'admin' ? 'owner' : 'staff',
    };
    const user = toAuthenticatedUser(identity, membership);
    getStorage()?.setItem(DEVELOPMENT_SESSION_KEY, JSON.stringify(user));
    await this.writeAudit('auth:development_login', user, { role });
    return { status: 'authenticated', user, memberships: [membership] };
  }

  private restoreDevelopmentSession(): AuthResolution {
    if (!this.allowDevelopmentAccess) return { status: 'unauthenticated' };
    const raw = getStorage()?.getItem(DEVELOPMENT_SESSION_KEY);
    if (!raw) return { status: 'unauthenticated' };
    try {
      const user = JSON.parse(raw) as AuthenticatedUser;
      return { status: 'authenticated', user, memberships: [] };
    } catch {
      getStorage()?.removeItem(DEVELOPMENT_SESSION_KEY);
      return { status: 'unauthenticated' };
    }
  }

  async logout(): Promise<void> {
    const cached = getVerifiedOfflineIdentity();
    if (cached) await this.writeAudit('auth:logout', cached);

    if (this.backend) await this.backend.signOut();
    clearVerifiedIdentity();
    getStorage()?.removeItem(DEVELOPMENT_SESSION_KEY);
    getStorage()?.removeItem(LEGACY_SESSION_KEY);
  }

  onAuthStateChange(callback: () => void): () => void {
    if (!this.backend) return () => undefined;
    return this.backend.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearVerifiedIdentity();
      globalThis.setTimeout(callback, 0);
    });
  }

  private async writeAudit(
    action: string,
    user: AuthenticatedUser,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await auditLogRepo.add({
      date: new Date(),
      action,
      entityType: 'user',
      entityId: user.id,
      details: JSON.stringify({ email: user.email, ...details }),
    });
  }

  async validateAdminProtection(
    targetProfileId: string,
    newRole?: UserRole,
    newActiveState?: boolean,
  ): Promise<void> {
    const target = await userProfileRepo.getById(targetProfileId);
    if (!target || target.role !== 'admin') return;

    const isDemoting = newRole && newRole !== 'admin';
    const isDeactivating = newActiveState === false;
    if (!isDemoting && !isDeactivating) return;

    const activeAdmins = (await userProfileRepo.list()).filter((profile) =>
      profile.role === 'admin'
      && profile.active
      && profile.id !== targetProfileId,
    );
    if (activeAdmins.length === 0) {
      throw new AppError(
        'Cannot deactivate or demote the final active administrator account',
        'LAST_ADMIN_PROTECTION',
      );
    }
  }

  async createUserProfile(data: {
    displayName: string;
    role: UserRole;
    employeeId?: string;
    authUserId?: string;
  }): Promise<string> {
    const now = new Date();
    const authUserId = data.authUserId || `local-profile-${Date.now()}`;
    const profile = await userProfileRepo.create({
      authUserId,
      employeeId: data.employeeId,
      displayName: data.displayName,
      role: data.role,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await auditLogRepo.add({
      date: now,
      action: 'account:create_local_profile',
      entityType: 'userProfile',
      entityId: profile.id,
      details: JSON.stringify({ displayName: data.displayName, role: data.role }),
    });
    return profile.id;
  }

  async setAccountActive(profileId: string, active: boolean): Promise<void> {
    await this.validateAdminProtection(profileId, undefined, active);
    await userProfileRepo.update(profileId, { active, updatedAt: new Date() });
    await auditLogRepo.add({
      date: new Date(),
      action: active ? 'account:activate' : 'account:deactivate',
      entityType: 'userProfile',
      entityId: profileId,
      details: JSON.stringify({ active }),
    });
  }

  async setAccountRole(profileId: string, role: UserRole): Promise<void> {
    await this.validateAdminProtection(profileId, role, undefined);
    await userProfileRepo.update(profileId, { role, updatedAt: new Date() });
    await auditLogRepo.add({
      date: new Date(),
      action: 'account:change_role',
      entityType: 'userProfile',
      entityId: profileId,
      details: JSON.stringify({ role }),
    });
  }
}

export const authService = new AuthService();
