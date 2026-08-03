import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.database';

export interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
  keySource: 'publishable' | 'legacy-anon';
}

export const SUPABASE_CONFIGURATION_MESSAGE =
  'Supabase is not configured. Copy .env.example to .env, set '
  + 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the development server. '
  + 'The local offline application remains available without these values.';

export class SupabaseConfigurationError extends Error {
  constructor(message = SUPABASE_CONFIGURATION_MESSAGE) {
    super(message);
    this.name = 'SupabaseConfigurationError';
  }
}

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function resolveSupabaseConfig(
  environment: SupabaseEnvironment,
): SupabasePublicConfig {
  const url = normalize(environment.VITE_SUPABASE_URL);
  const publishableKey = normalize(environment.VITE_SUPABASE_PUBLISHABLE_KEY);
  const legacyAnonKey = normalize(environment.VITE_SUPABASE_ANON_KEY);
  const key = publishableKey ?? legacyAnonKey;

  if (!url || !key) {
    throw new SupabaseConfigurationError();
  }

  return {
    url,
    publishableKey: key,
    keySource: publishableKey ? 'publishable' : 'legacy-anon',
  };
}

export function readSupabaseConfiguration(
  environment: SupabaseEnvironment,
): {
  config: SupabasePublicConfig | null;
  error: SupabaseConfigurationError | null;
} {
  try {
    return {
      config: resolveSupabaseConfig(environment),
      error: null,
    };
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      return { config: null, error };
    }
    throw error;
  }
}

const runtimeConfiguration = readSupabaseConfiguration(import.meta.env);

export const supabaseConfig = runtimeConfiguration.config;
export const supabaseConfigurationError = runtimeConfiguration.error;
export const isSupabaseConfigured = supabaseConfig !== null;

export const supabase: SupabaseClient<Database> | null = supabaseConfig
  ? createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabaseClient(): SupabaseClient<Database> {
  if (!supabase) {
    throw supabaseConfigurationError ?? new SupabaseConfigurationError();
  }
  return supabase;
}
