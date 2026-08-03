import React from 'react';
import { Laptop, RefreshCw, RotateCcw, ShieldX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/features/auth/auth.store';
import { useToast } from '@/components/ui/Toast';
import type { DeviceRow } from '@/types/supabase.database';
import { deviceService } from './device.service';

const time = (value: string | null) => (value ? new Date(value).toLocaleString() : 'Never');

export function DeviceManagement() {
  const user = useAuthStore((state) => state.user);
  const mode = useAuthStore((state) => state.sessionMode);
  const { showToast } = useToast();
  const [devices, setDevices] = React.useState<DeviceRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user || mode !== 'online') return;
    setLoading(true);
    try {
      setDevices(await deviceService.list(user.storeId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Device list failed.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, mode, showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (user?.membershipRole !== 'owner') return null;

  const revoke = async (device: DeviceRow) => {
    if (!confirm(`Revoke ${device.name}? It will lose future cloud access when online.`)) return;
    try {
      await deviceService.revoke(user.storeId, device.id);
      showToast('Device revoked for future cloud access.', 'success');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Device revocation failed.', 'error');
    }
  };

  const restore = async (device: DeviceRow) => {
    if (!confirm(`Restore ${device.name}? It will be allowed to sign in and sync again.`)) return;
    try {
      await deviceService.restore(user.storeId, device.id);
      showToast('Device restored. It can sign in and sync again.', 'success');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Device restore failed.', 'error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Store devices</CardTitle>
          <Button variant="outline" onClick={() => void load()} disabled={loading || mode !== 'online'}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Owners can revoke or restore cloud access. An already-offline device retains its local IndexedDB data and
          learns about access changes when it reconnects.
        </p>
        {mode !== 'online' ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            Connect and verify your session to manage devices.
          </p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <Laptop className="mt-1 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {device.name}{' '}
                      {device.device_key === user.deviceId && <span className="text-xs text-primary">(this device)</span>}
                    </div>
                    <div className="break-all text-xs text-muted-foreground">{device.device_key}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Registered {time(device.created_at)} - Active {time(device.last_seen_at)} - Synced {time(device.last_sync_at)}
                    </div>
                    <div className="text-xs font-medium">{device.revoked_at ? `Revoked ${time(device.revoked_at)}` : 'Active'}</div>
                  </div>
                </div>
                {device.revoked_at ? (
                  <Button variant="outline" onClick={() => void restore(device)}>
                    <RotateCcw className="h-4 w-4" /> Restore
                  </Button>
                ) : device.device_key === user.deviceId ? (
                  <span className="text-xs text-muted-foreground">Current device</span>
                ) : (
                  <Button variant="destructive" onClick={() => void revoke(device)}>
                    <ShieldX className="h-4 w-4" /> Revoke
                  </Button>
                )}
              </div>
            ))}
            {!loading && !devices.length && <p className="text-sm text-muted-foreground">No registered devices were returned.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
