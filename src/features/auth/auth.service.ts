import { db } from '@/db/database';
import { UserProfile, UserRole } from '@/types';
import { AuthenticatedUser, LoginCredentials } from './auth.types';
import { generateId } from '@/shared/utils/id';
import { AppError } from '@/shared/errors/AppError';

const SESSION_KEY = 'tindahan_auth_session';

export class AuthService {
  /**
   * Initialize default admin and employee accounts if none exist in IndexedDB.
   */
  async ensureDefaultAccounts(): Promise<void> {
    const count = await db.userProfiles.count();
    if (count === 0) {
      const now = new Date();
      
      // Default Admin Profile
      await db.userProfiles.add({
        id: generateId(),
        authUserId: 'admin-auth-id',
        displayName: 'Store Manager (Admin)',
        role: 'admin',
        active: true,
        createdAt: now,
        updatedAt: now
      });

      // Default Employee Profile
      await db.userProfiles.add({
        id: generateId(),
        authUserId: 'employee-auth-id',
        displayName: 'Store Staff (Employee)',
        role: 'employee',
        active: true,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  /**
   * Authenticates user against credentials (Dev & Supabase compatible).
   */
  async login(credentials: LoginCredentials): Promise<AuthenticatedUser> {
    await this.ensureDefaultAccounts();
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;

    // Check credentials (Dev Adapter simulation)
    let role: UserRole = 'employee';
    ariaCheck: if (email === 'admin@tindahan.ph' || email === 'admin') {
      if (password !== 'admin123') throw new AppError('Invalid email or password', 'INVALID_CREDENTIALS');
      role = 'admin';
    } else if (email === 'employee@tindahan.ph' || email === 'employee' || email === 'staff') {
      if (password !== 'employee123') throw new AppError('Invalid email or password', 'INVALID_CREDENTIALS');
      role = 'employee';
    } else {
      // Dynamic profile lookup
      const profiles = await db.userProfiles.toArray();
      const match = profiles.find(p => p.displayName.toLowerCase().includes(email));
      if (!match || !match.active) {
        throw new AppError('Invalid email or password', 'INVALID_CREDENTIALS');
      }
      role = match.role;
    }

    const profiles = await db.userProfiles.where('role').equals(role).toArray();
    const profile = profiles.find(p => p.active) || profiles[0];

    const authUser: AuthenticatedUser = {
      id: profile ? profile.authUserId : `${role}-auth-id`,
      email: `${role}@tindahan.ph`,
      displayName: profile ? profile.displayName : `${role.toUpperCase()} User`,
      role,
      employeeId: profile?.employeeId
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    
    // Log audit event
    await db.auditLogs.add({
      id: generateId(),
      date: new Date(),
      action: 'auth:login',
      entityType: 'user',
      entityId: authUser.id,
      details: JSON.stringify({ email: authUser.email, role: authUser.role })
    });

    return authUser;
  }

  /**
   * Restores current active session from storage.
   */
  async getSession(): Promise<AuthenticatedUser | null> {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthenticatedUser;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  /**
   * Clears session storage and logs out.
   */
  async logout(): Promise<void> {
    const session = await this.getSession();
    if (session) {
      await db.auditLogs.add({
        id: generateId(),
        date: new Date(),
        action: 'auth:logout',
        entityType: 'user',
        entityId: session.id,
        details: JSON.stringify({ email: session.email })
      });
    }
    localStorage.removeItem(SESSION_KEY);
  }

  /**
   * Ensures that administrative protection rules are preserved (cannot remove final active admin).
   */
  async validateAdminProtection(targetProfileId: string, newRole?: UserRole, newActiveState?: boolean): Promise<void> {
    const target = await db.userProfiles.get(targetProfileId);
    if (!target) return;

    if (target.role === 'admin') {
      const isDemoting = newRole && newRole !== 'admin';
      const isDeactivating = newActiveState === false;

      if (isDemoting || isDeactivating) {
        const activeAdmins = await db.userProfiles
          .where('role')
          .equals('admin')
          .filter(p => p.active && p.id !== targetProfileId)
          .toArray();

        if (activeAdmins.length === 0) {
          throw new AppError('Cannot deactivate or demote the final active administrator account', 'LAST_ADMIN_PROTECTION');
        }
      }
    }
  }

  /**
   * Admin-only: Creates new user profile connected to an employee.
   */
  async createUserProfile(data: {
    displayName: string;
    role: UserRole;
    employeeId?: string;
    authUserId?: string;
  }): Promise<string> {
    const now = new Date();
    const id = generateId();
    const authUserId = data.authUserId || `user-${Date.now()}`;

    await db.userProfiles.add({
      id,
      authUserId,
      employeeId: data.employeeId,
      displayName: data.displayName,
      role: data.role,
      active: true,
      createdAt: now,
      updatedAt: now
    });

    await db.auditLogs.add({
      id: generateId(),
      date: now,
      action: 'account:create',
      entityType: 'userProfile',
      entityId: id,
      details: JSON.stringify({ displayName: data.displayName, role: data.role })
    });

    return id;
  }

  /**
   * Admin-only: Toggles account activation state safely.
   */
  async setAccountActive(profileId: string, active: boolean): Promise<void> {
    await this.validateAdminProtection(profileId, undefined, active);
    await db.userProfiles.update(profileId, { active, updatedAt: new Date() });

    await db.auditLogs.add({
      id: generateId(),
      date: new Date(),
      action: active ? 'account:activate' : 'account:deactivate',
      entityType: 'userProfile',
      entityId: profileId,
      details: JSON.stringify({ active })
    });
  }

  /**
   * Admin-only: Updates user role safely.
   */
  async setAccountRole(profileId: string, role: UserRole): Promise<void> {
    await this.validateAdminProtection(profileId, role, undefined);
    await db.userProfiles.update(profileId, { role, updatedAt: new Date() });

    await db.auditLogs.add({
      id: generateId(),
      date: new Date(),
      action: 'account:change_role',
      entityType: 'userProfile',
      entityId: profileId,
      details: JSON.stringify({ role })
    });
  }
}

export const authService = new AuthService();
