import React, { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { getAccessibleTextColor, isValidHexColor } from '@/shared/utils/color';

export interface BrandingProviderProps {
  children: React.ReactNode;
  previewName?: string;
  previewPrimaryHex?: string;
  previewAccentHex?: string;
}

export function BrandingProvider({
  children,
  previewName,
  previewPrimaryHex,
  previewAccentHex
}: BrandingProviderProps) {
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first(), []);

  const appName = previewName ?? storeSettings?.applicationName ?? 'Tindahan Manager';
  const primaryColor = (previewPrimaryHex && isValidHexColor(previewPrimaryHex)) 
    ? previewPrimaryHex 
    : (storeSettings?.themePrimaryColor || '#15803D');
  
  const accentColor = (previewAccentHex && isValidHexColor(previewAccentHex)) 
    ? previewAccentHex 
    : (storeSettings?.themeAccentColor || '#0369A1');

  useEffect(() => {
    // Update document title
    document.title = appName;

    // Apply root CSS variables
    const root = document.documentElement;
    if (isValidHexColor(primaryColor)) {
      root.style.setProperty('--color-primary', primaryColor);
      root.style.setProperty('--primary', primaryColor);
      root.style.setProperty('--color-on-primary', getAccessibleTextColor(primaryColor));
    }

    if (isValidHexColor(accentColor)) {
      root.style.setProperty('--color-accent', accentColor);
      root.style.setProperty('--color-on-accent', getAccessibleTextColor(accentColor));
    }
  }, [appName, primaryColor, accentColor]);

  return <>{children}</>;
}
