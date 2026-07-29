import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth.store';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, refreshProfile } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (status === 'loading') {
      refreshProfile();
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-muted-foreground">Authenticating session...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
