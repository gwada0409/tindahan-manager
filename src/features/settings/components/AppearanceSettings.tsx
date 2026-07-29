import React, { useState, useEffect } from 'react';
import { Store } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { settingsService } from '@/features/settings/settings.service';
import { isValidHexColor, normalizeHex } from '@/shared/utils/color';
import { StockIndicator } from '@/features/inventory/components/StockIndicator';
import { Palette, RotateCcw, Save, LayoutDashboard, ShoppingCart } from 'lucide-react';
import { BrandingProvider } from '../BrandingProvider';

export interface AppearanceSettingsProps {
  storeInfo: Store | null;
  onStoreUpdated: () => void;
}

const DEFAULT_APP_NAME = 'Tindahan Manager';
const DEFAULT_PRIMARY_HEX = '#15803D';
const DEFAULT_ACCENT_HEX = '#0369A1';

export function AppearanceSettings({ storeInfo, onStoreUpdated }: AppearanceSettingsProps) {
  const { showToast } = useToast();

  const [applicationName, setApplicationName] = useState(DEFAULT_APP_NAME);
  const [themePrimaryColor, setThemePrimaryColor] = useState(DEFAULT_PRIMARY_HEX);
  const [themeAccentColor, setThemeAccentColor] = useState(DEFAULT_ACCENT_HEX);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (storeInfo) {
      setApplicationName(storeInfo.applicationName || DEFAULT_APP_NAME);
      setThemePrimaryColor(storeInfo.themePrimaryColor || DEFAULT_PRIMARY_HEX);
      setThemeAccentColor(storeInfo.themeAccentColor || DEFAULT_ACCENT_HEX);
    }
  }, [storeInfo]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeInfo) return;

    if (!isValidHexColor(themePrimaryColor)) {
      showToast('Primary color must be a valid hexadecimal value (e.g. #15803D)', 'error');
      return;
    }

    if (!isValidHexColor(themeAccentColor)) {
      showToast('Accent color must be a valid hexadecimal value (e.g. #0369A1)', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await settingsService.updateStoreInfo(storeInfo.id, {
        applicationName: applicationName.trim() || DEFAULT_APP_NAME,
        themePrimaryColor: normalizeHex(themePrimaryColor),
        themeAccentColor: normalizeHex(themeAccentColor)
      });
      showToast('Appearance settings saved persistently!', 'success');
      onStoreUpdated();
    } catch (err: any) {
      showToast('Failed to save appearance settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (storeInfo) {
      setApplicationName(storeInfo.applicationName || DEFAULT_APP_NAME);
      setThemePrimaryColor(storeInfo.themePrimaryColor || DEFAULT_PRIMARY_HEX);
      setThemeAccentColor(storeInfo.themeAccentColor || DEFAULT_ACCENT_HEX);
      showToast('Preview cancelled and reset to saved settings.', 'info');
    }
  };

  const handleRestoreDefaults = () => {
    setApplicationName(DEFAULT_APP_NAME);
    setThemePrimaryColor(DEFAULT_PRIMARY_HEX);
    setThemeAccentColor(DEFAULT_ACCENT_HEX);
    showToast('Restored default branding and colors.', 'info');
  };

  return (
    <BrandingProvider
      previewName={applicationName}
      previewPrimaryHex={themePrimaryColor}
      previewAccentHex={themeAccentColor}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Appearance & Theme Customization
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Application Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Application Name</label>
                <Input
                  value={applicationName}
                  onChange={e => setApplicationName(e.target.value)}
                  placeholder="e.g. Tindahan Manager"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Replaces the product name in headers, navigation, login screen, and browser title bar.
                </p>
              </div>

              {/* Color Pickers & Hex Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Theme Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary Theme Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      aria-label="Pick primary theme color"
                      value={isValidHexColor(themePrimaryColor) ? normalizeHex(themePrimaryColor) : '#15803D'}
                      onChange={e => setThemePrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={themePrimaryColor}
                      onChange={e => setThemePrimaryColor(e.target.value)}
                      placeholder="#15803D"
                      className="font-mono text-sm uppercase"
                    />
                  </div>
                </div>

                {/* Accent Theme Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Accent / CTA Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      aria-label="Pick accent theme color"
                      value={isValidHexColor(themeAccentColor) ? normalizeHex(themeAccentColor) : '#0369A1'}
                      onChange={e => setThemeAccentColor(e.target.value)}
                      className="w-12 h-10 rounded border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={themeAccentColor}
                      onChange={e => setThemeAccentColor(e.target.value)}
                      placeholder="#0369A1"
                      className="font-mono text-sm uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Block */}
              <div className="border border-border rounded-xl p-5 bg-background space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Real-time Component & Accessibility Preview
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {/* Controls & Nav Preview */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">Interactive Elements</div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button">Primary Button</Button>
                      <Button type="button" variant="outline">Secondary</Button>
                      <Button type="button" variant="destructive">Destructive</Button>
                    </div>

                    <div className="p-2 border rounded-md bg-white space-y-1">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-on-primary text-xs font-semibold">
                        <LayoutDashboard className="w-4 h-4" /> Selected Nav Item
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md text-foreground hover:bg-muted text-xs font-medium">
                        <ShoppingCart className="w-4 h-4" /> Regular Nav Item
                      </div>
                    </div>
                  </div>

                  {/* Stock Status Cues (Non-color overridden!) */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">Semantic Stock Statuses (Unchanged)</div>
                    <div className="flex flex-wrap gap-2">
                      <StockIndicator quantity={0} status="out-of-stock" compact />
                      <StockIndicator quantity={2} status="critical" compact />
                      <StockIndicator quantity={7} status="low-stock" compact />
                      <StockIndicator quantity={34} status="in-stock" compact />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save & Reset Actions */}
              <div className="flex flex-wrap justify-between items-center gap-4 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={handleRestoreDefaults}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Restore Defaults
                </Button>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={handleCancel}>
                    Cancel Preview
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Saving...' : 'Save Appearance'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </BrandingProvider>
  );
}
