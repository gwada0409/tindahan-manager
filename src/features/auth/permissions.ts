import { UserRole, Permission } from '@/types';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'dashboard:view',
    'sales:use',
    'inventory:view',
    'inventory:manage',
    'inventory:create-product',
    'inventory:edit-product',
    'inventory:restock',
    'inventory:adjust-stock',
    'inventory:delete-product',
    'services:manage',
    'utang:manage',
    'gcash:manage',
    'bills:manage',
    'employees:manage',
    'accounts:manage',
    'vault:manage',
    'reports:view',
    'settings:manage'
  ],
  employee: [
    'dashboard:view',
    'sales:use',
    'inventory:view',
    'inventory:create-product',
    'inventory:edit-product',
    'inventory:restock',
    'services:manage',
    'utang:manage',
    'gcash:manage',
    'bills:manage'
  ]
};

export function hasRolePermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
