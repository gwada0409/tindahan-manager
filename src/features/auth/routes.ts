import { Permission } from '@/types';

export interface AppRoute {
  path: string;
  label: string;
  requiredPermission: Permission;
  iconName: string;
}

export const APP_ROUTES: AppRoute[] = [
  { path: '/', label: 'Dashboard', requiredPermission: 'dashboard:view', iconName: 'LayoutDashboard' },
  { path: '/sales', label: 'Sales', requiredPermission: 'sales:use', iconName: 'ShoppingCart' },
  { path: '/inventory', label: 'Inventory', requiredPermission: 'inventory:view', iconName: 'Package' },
  { path: '/services', label: 'Services', requiredPermission: 'services:manage', iconName: 'Wrench' },
  { path: '/utang', label: 'Utang', requiredPermission: 'utang:manage', iconName: 'BookUser' },
  { path: '/gcash', label: 'GCash', requiredPermission: 'gcash:manage', iconName: 'Smartphone' },
  { path: '/bills', label: 'Bills', requiredPermission: 'bills:manage', iconName: 'Receipt' },
  { path: '/employees', label: 'Employees', requiredPermission: 'employees:manage', iconName: 'Users' },
  { path: '/vault', label: 'Vault', requiredPermission: 'vault:manage', iconName: 'Wallet' },
  { path: '/reports', label: 'Reports', requiredPermission: 'reports:view', iconName: 'BarChart3' },
  { path: '/settings', label: 'Settings', requiredPermission: 'settings:manage', iconName: 'Settings' }
];
