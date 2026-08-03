import { Store } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function StoreSelection() {
  const { status, memberships, pendingIdentity, selectStore, logout, error } = useAuthStore();
  const navigate = useNavigate();

  if ((status !== 'selecting-store' && status !== 'loading') || !pendingIdentity) {
    return <Navigate to="/" replace />;
  }

  const chooseStore = async (storeId: string) => {
    await selectStore(storeId);
    navigate('/', { replace: true });
  };

  const cancel = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle>Select a store</CardTitle>
          <p className="text-sm text-muted-foreground">Choose which active membership to use for this session, {pendingIdentity.displayName}.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          <div className="grid gap-3">
            {memberships.map((membership) => (
              <button key={membership.storeId} type="button" onClick={() => void chooseStore(membership.storeId)} className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Store className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block truncate font-semibold text-foreground">{membership.storeName}</span><span className="block text-sm capitalize text-muted-foreground">{membership.role}</span></span>
              </button>
            ))}
          </div>
          <Button variant="outline" className="w-full" onClick={() => void cancel()}>Cancel and sign out</Button>
        </CardContent>
      </Card>
    </main>
  );
}
