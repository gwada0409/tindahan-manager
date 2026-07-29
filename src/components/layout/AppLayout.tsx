import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Wrench, 
  BookUser, 
  Smartphone, 
  Receipt, 
  Users, 
  Wallet, 
  BarChart3,
  Menu,
  Settings,
  LogOut,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/auth.store';
import { APP_ROUTES } from '@/features/auth/routes';
import { BrandingProvider } from '@/features/settings/BrandingProvider';

const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wrench,
  BookUser,
  Smartphone,
  Receipt,
  Users,
  Wallet,
  BarChart3,
  Settings
};

export function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout, hasPermission } = useAuthStore();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first(), []);
  const appName = storeSettings?.applicationName || 'Tindahan Manager';

  // Filter routes based on user permissions
  const authorizedRoutes = APP_ROUTES.filter(r => hasPermission(r.requiredPermission));

  const getPageTitle = () => {
    const route = APP_ROUTES.find((r) => r.path === location.pathname);
    return route ? route.label : appName;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <BrandingProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-border bg-white shadow-sm z-20">
          <div className="flex h-16 items-center px-6 border-b border-border">
            <span className="text-xl font-bold text-primary tracking-tight truncate">{appName}</span>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {authorizedRoutes.map((route) => {
              const Icon = ICON_MAP[route.iconName] || LayoutDashboard;
              return (
                <NavLink
                  key={route.path}
                  to={route.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary text-on-primary shadow-sm" 
                        : "text-foreground hover:bg-muted"
                    )
                  }
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{route.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User Account Info & Logout in Sidebar Footer */}
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{user?.displayName || 'Guest User'}</div>
                <div className="text-xs text-muted-foreground capitalize font-mono">{user?.role || 'employee'}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-white shadow-sm z-10">
            <h1 className="font-semibold text-lg text-foreground truncate">{getPageTitle()}</h1>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 -mr-2 text-foreground"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </header>

          {/* Mobile Drawer */}
          {isMobileMenuOpen && (
            <div className="absolute inset-0 z-30 flex md:hidden">
              <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
              <div className="relative w-64 bg-white h-full shadow-lg flex flex-col animate-in slide-in-from-left">
                <div className="flex h-14 items-center px-6 border-b border-border">
                  <span className="text-xl font-bold text-primary tracking-tight truncate">{appName}</span>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                  {authorizedRoutes.map((route) => {
                    const Icon = ICON_MAP[route.iconName] || LayoutDashboard;
                    return (
                      <NavLink
                        key={route.path}
                        to={route.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium transition-colors",
                            isActive 
                              ? "bg-primary text-on-primary shadow-sm" 
                              : "text-foreground hover:bg-muted"
                          )
                        }
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{route.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>

                <div className="p-4 border-t border-border space-y-3">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                      {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">{user?.displayName}</div>
                      <div className="text-xs text-muted-foreground capitalize font-mono">{user?.role}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-base font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Header */}
          <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-border bg-white shadow-sm">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{getPageTitle()}</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/20 capitalize font-mono">
                {user?.role || 'employee'}
              </span>
              <span className="text-sm font-medium text-foreground">{user?.displayName}</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8 pb-20 md:pb-8">
            <Outlet />
          </main>
        </div>

        {/* Mobile Bottom Navigation - showing top 4 authorized items */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex items-center justify-around z-20 px-2 pb-safe">
          {authorizedRoutes.slice(0, 4).map((route) => {
            const Icon = ICON_MAP[route.iconName] || LayoutDashboard;
            return (
              <NavLink
                key={route.path}
                to={route.path}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{route.label}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open More Menu"
            className="flex flex-col items-center justify-center w-16 h-full gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </div>
    </BrandingProvider>
  );
}
