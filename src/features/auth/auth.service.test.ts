import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService, mapMembershipRole } from './auth.service';
import { hasRolePermission } from './permissions';
import { db } from '@/db/database';
import { generateId } from '@/shared/utils/id';

describe('Auth and permission system', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('maps cloud membership roles onto the existing permission roles', () => {
    expect(mapMembershipRole('owner')).toBe('admin');
    expect(mapMembershipRole('administrator')).toBe('admin');
    expect(mapMembershipRole('cashier')).toBe('employee');
    expect(mapMembershipRole('staff')).toBe('employee');
  });

  it('enforces the existing permission matrix', () => {
    expect(hasRolePermission('admin', 'settings:manage')).toBe(true);
    expect(hasRolePermission('admin', 'vault:manage')).toBe(true);
    expect(hasRolePermission('employee', 'dashboard:view')).toBe(true);
    expect(hasRolePermission('employee', 'sales:use')).toBe(true);
    expect(hasRolePermission('employee', 'settings:manage')).toBe(false);
    expect(hasRolePermission('employee', 'accounts:manage')).toBe(false);
  });

  it('prevents deactivating or demoting the final active administrator', async () => {
    const service = new AuthService({ backend: null, allowDevelopmentAccess: true });
    const adminId = generateId();
    await db.userProfiles.clear();
    await db.userProfiles.add({
      id: adminId,
      authUserId: 'sole-admin',
      displayName: 'Sole Admin',
      role: 'admin',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.validateAdminProtection(adminId, undefined, false))
      .rejects.toThrow('Cannot deactivate or demote the final active administrator account');
    await expect(service.validateAdminProtection(adminId, 'employee', undefined))
      .rejects.toThrow('Cannot deactivate or demote the final active administrator account');
  });

  it('offers password-free quick access only through the explicit development path', async () => {
    const service = new AuthService({ backend: null, allowDevelopmentAccess: true });
    const resolution = await service.loginDevelopment('admin');
    expect(resolution.status).toBe('authenticated');
    if (resolution.status !== 'authenticated') throw new Error('Expected authenticated resolution');
    expect(resolution.user.role).toBe('admin');
    expect(resolution.user.membershipRole).toBe('owner');

    const restored = await service.restoreSession();
    expect(restored.status).toBe('authenticated');

    await service.logout();
    expect((await service.restoreSession()).status).toBe('unauthenticated');
  });

  it('does not expose development access when it is disabled', async () => {
    const service = new AuthService({ backend: null, allowDevelopmentAccess: false });
    await expect(service.loginDevelopment('admin')).rejects.toThrow('Development quick access is disabled');
  });
});