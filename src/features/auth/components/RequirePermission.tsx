import React from 'react';
import { Permission } from '@/types';
import { useAuthStore } from '../auth.store';
import { Unauthorized } from './Unauthorized';

export interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { hasPermission, status } = useAuthStore();

  if (status === 'loading') {
    return null;
  }

  if (!hasPermission(permission)) {
    return <Unauthorized />;
  }

  return <>{children}</>;
}
