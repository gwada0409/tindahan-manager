import { describe, expect, it } from 'vitest';
import {
  readSupabaseConfiguration,
  resolveSupabaseConfig,
  SUPABASE_CONFIGURATION_MESSAGE,
  SupabaseConfigurationError,
} from './supabase';

describe('Supabase public configuration', () => {
  it('keeps the local application available when runtime values are absent', () => {
    const state = readSupabaseConfiguration({});
    expect(state.config).toBeNull();
    expect(state.error?.message).toBe(SUPABASE_CONFIGURATION_MESSAGE);
  });

  it('prefers the publishable key', () => {
    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: ' https://project.example.supabase.co ',
      VITE_SUPABASE_PUBLISHABLE_KEY: ' publishable-test-value ',
      VITE_SUPABASE_ANON_KEY: 'legacy-test-value',
    })).toEqual({
      url: 'https://project.example.supabase.co',
      publishableKey: 'publishable-test-value',
      keySource: 'publishable',
    });
  });

  it('temporarily supports the legacy anon key', () => {
    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: 'https://project.example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'legacy-test-value',
    })).toMatchObject({
      publishableKey: 'legacy-test-value',
      keySource: 'legacy-anon',
    });
  });

  it('returns a useful error when public configuration is incomplete', () => {
    expect(() => resolveSupabaseConfig({}))
      .toThrow(new SupabaseConfigurationError(SUPABASE_CONFIGURATION_MESSAGE));
    expect(SUPABASE_CONFIGURATION_MESSAGE).toContain('VITE_SUPABASE_URL');
    expect(SUPABASE_CONFIGURATION_MESSAGE).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(SUPABASE_CONFIGURATION_MESSAGE).not.toMatch(/service.?role/i);
  });
});
