import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Store } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { settingsService } from '@/features/settings/settings.service';
import { AppearanceSettings } from '@/features/settings/components/AppearanceSettings';
import { DeviceManagement } from '@/features/devices/DeviceManagement';

export function Settings() {
  const [storeInfo, setStoreInfo] = useState<Store | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const pendingChanges = useLiveQuery(() => db.syncQueue.count(), []) ?? 0;

  const fetchStore = async () => {
    const store = await settingsService.getStoreInfo();
    if (store) {
      setStoreInfo(store);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (storeInfo) {
      await settingsService.updateStoreInfo(storeInfo.id, {
        name: formData.get('name') as string,
        ownerName: formData.get('ownerName') as string,
        contact: formData.get('contact') as string,
        address: formData.get('address') as string,
      });
      showToast('Store settings saved successfully!');
    }
  };

  const downloadBackup = async (data: unknown, reason = 'backup') => {
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const compress = jsonBlob.size >= 1_000_000 && typeof CompressionStream !== 'undefined';
    const blob = compress ? await new Response(jsonBlob.stream().pipeThrough(new CompressionStream('gzip'))).blob() : jsonBlob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tindahan-${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}.json${compress ? '.gz' : ''}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      await downloadBackup(await settingsService.exportData());
      showToast('Checksummed backup exported!');
    } catch {
      showToast('Export failed.', 'error');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.gz,.json.gz';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = file.name.endsWith('.gz') && typeof DecompressionStream !== 'undefined'
          ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
          : await file.text();
        const data: unknown = JSON.parse(text);
        const preview = await settingsService.validateBackup(data);
        const approved = window.confirm(`Restore ${preview.totalRecords} records exported ${new Date(preview.exportedAt).toLocaleString()}? Active local tables will be replaced after an automatic recovery point is stored.`);
        if (!approved) return;
        await settingsService.importData(data);
        showToast('Validated backup restored successfully!');
        await fetchStore();
      } catch (err) {
        showToast('Import failed. Check your file format.', 'error');
      }
    };
    input.click();
  };

  const handleReset = async () => {
    try {
      await downloadBackup(await settingsService.exportData(), 'pre-reset');
      await settingsService.resetDatabase();
      showToast('All data cleared. Reloading...', 'warning');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast('Reset failed.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      {/* Branding & Appearance Customization */}
      <AppearanceSettings storeInfo={storeInfo} onStoreUpdated={fetchStore} />

      {/* Store Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Store Business Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Store Branch Name</label>
                <Input name="name" defaultValue={storeInfo?.name} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Owner Name</label>
                <Input name="ownerName" defaultValue={storeInfo?.ownerName} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Number</label>
                <Input name="contact" defaultValue={storeInfo?.contact} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input name="address" defaultValue={storeInfo?.address} />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <Button type="submit">Save Business Details</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DeviceManagement />

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export a versioned, checksummed backup for another device or disaster recovery. Restore validates every table and checksum before replacing active local data in one transaction.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleExport}>Export Backup (JSON)</Button>
            <Button variant="outline" onClick={handleImport}>Import Data</Button>
          </div>
          <div className="pt-4 border-t border-border">
            <Button variant="destructive" onClick={() => setIsResetConfirmOpen(true)}>Reset All Data (DANGER)</Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleReset}
        title="Reset All Data"
        message={`This permanently deletes all local products, sales, customers, settings, and ${pendingChanges} pending cloud change${pendingChanges === 1 ? '' : 's'}. Export a backup first. This cannot be undone.`}
        confirmText="Delete Everything"
        variant="destructive"
      />
    </div>
  );
}
