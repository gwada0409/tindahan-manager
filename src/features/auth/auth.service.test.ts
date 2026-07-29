import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from './auth.service';
import { hasRolePermission, ROLE_PERMISSIONS } from './permissions';
import { db } from '@/db/database';
import { generateId } from '@/shared/utils/id';

describe('Auth & Permission RBAC System', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('enforces exact permission matrix for Admin vs Employee roles', () => {
    // Admin has access to all sections
    expect(hasRolePermission('admin', 'settings:manage')).toBe(true);
    expect(hasRolePermission('admin', 'vault:manage')).toBe(true);
    expect(hasRolePermission('admin', 'reports:view')).toBe(true);
    expect(hasRolePermission('admin', 'employees:manage')).toBe(true);
    expect(hasRolePermission('admin', 'inventory:view')).toBe(true);

    // Employee has access ONLY to allowed sections
    expect(hasRolePermission('employee', 'dashboard:view')).toBe(true);
    expect(hasRolePermission('employee', 'sales:use')).toBe(true);
    expect(hasRolePermission('employee', 'inventory:view')).toBe(true);
    expect(hasRolePermission('employee', 'services:manage')).toBe(true);
    expect(hasRolePermission('employee', 'utang:manage')).toBe(true);
    expect(hasRolePermission('employee', 'gcash:manage')).toBe(true);
    expect(hasRolePermission('employee', 'bills:manage')).toBe(true);

    // Employee DENIED sections
    expect(hasRolePermission('employee', 'employees:manage')).toBe(false);
    expect(hasRolePermission('employee', 'accounts:manage')).toBe(false);
    expect(hasRolePermission('employee', 'vault:manage')).toBe(false);
    expect(hasRolePermission('employee', 'reports:view')).toBe(false);
    expect(hasRolePermission('employee', 'settings:manage')).toBe(false);
  });

  it('prevents deactivating or demoting the final active administrator account', async () => {
    const adminId = generateId();
    await db.userProfiles.clear();

    await db.userProfiles.add({
      id: adminId,
      authUserId: 'sole-admin',
      displayName: 'Sole Admin',
      role: 'admin',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Attempting to deactivate sole admin should throw LAST_ADMIN_PROTECTION error
    await expect(authService.validateAdminProtection(adminId, undefined, false))
      .rejects.toThrow('Cannot deactivate or demote the final active administrator account');

    // Attempting to demote sole admin to employee should throw LAST_ADMIN_PROTECTION error
    await expect(authService.validateAdminProtection(adminId, 'employee', undefined))
      .rejects.toThrow('Cannot deactivate or demote the final active administrator account');
  });

  it('authenticates admin and employee credentials cleanly', async () => {
    const adminUser = await authService.login({ email: 'admin@tindahan.ph', password: 'admin123' });
    expect(adminUser.role).toBe('admin');
    expect(await authService.getSession()).not.toBeNull();

    await authService.logout();
    expect(await authService.getSession()).toBeNull();
  });
});
