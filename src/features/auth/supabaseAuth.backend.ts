import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/supabase';
import type { Database } from '@/types/supabase.database';
import { AppError } from '@/shared/errors/AppError';
import type {
  BasicAuthIdentity,
  SignupDetails,
  StoreMembership,
  StoreMembershipRole,
} from './auth.types';

export interface CloudSignupResult {
  user: BasicAuthIdentity | null;
  session: Session | null;
}

export interface AuthBackend {
  signIn(email: string, password: string): Promise<Session>;
  signUp(details: SignupDetails, redirectTo: string): Promise<CloudSignupResult>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  getSession(): Promise<Session | null>;
  getVerifiedUser(): Promise<User | null>;
  isReachable(): Promise<boolean>;
  listMemberships(userId: string): Promise<StoreMembership[]>;
  createOwnerStore(storeName: string): Promise<StoreMembership[]>;
  registerDevice(userId: string, membership: StoreMembership, deviceId: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void;
}

function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Browser device';
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return platform ? `${platform} browser` : 'Browser device';
}
function getDisplayName(user: User): string {
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }
  return user.email?.split('@')[0] || 'Store user';
}

export function toBasicIdentity(user: User): BasicAuthIdentity {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: getDisplayName(user),
  };
}

function isMembershipRole(value: unknown): value is StoreMembershipRole {
  return value === 'owner'
    || value === 'administrator'
    || value === 'cashier'
    || value === 'staff';
}

function getJoinedStore(value: unknown): { id: string; name: string } | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'object' || candidate === null) return null;

  const record = candidate as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.name === 'string'
    ? { id: record.id, name: record.name }
    : null;
}

export function parseMembershipRows(value: unknown): StoreMembership[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const row = candidate as Record<string, unknown>;
    const store = getJoinedStore(row.stores);
    if (!store || !isMembershipRole(row.role) || row.active !== true) return [];

    return [{ storeId: store.id, storeName: store.name, role: row.role }];
  });
}

export class SupabaseAuthBackend implements AuthBackend {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new AppError(error?.message ?? 'Sign-in did not return a session.', 'AUTH_SIGN_IN_FAILED');
    }
    return data.session;
  }

  async signUp(details: SignupDetails, redirectTo: string): Promise<CloudSignupResult> {
    const { data, error } = await this.client.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          display_name: details.displayName,
          store_name: details.storeName,
        },
      },
    });
    if (error) throw new AppError(error.message, 'AUTH_SIGN_UP_FAILED');

    return {
      user: data.user ? toBasicIdentity(data.user) : null,
      session: data.session,
    };
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new AppError(error.message, 'AUTH_PASSWORD_RESET_FAILED');
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new AppError(error.message, 'AUTH_PASSWORD_UPDATE_FAILED');
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new AppError(error.message, 'AUTH_SESSION_FAILED');
    return data.session;
  }

  async getVerifiedUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new AppError(error.message, 'AUTH_VERIFICATION_FAILED');
    return data.user;
  }

  async isReachable(): Promise<boolean> {
    if (!supabaseConfig) return false;

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(`${supabaseConfig.url}/auth/v1/health`, {
        cache: 'no-store',
        headers: { apikey: supabaseConfig.publishableKey },
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  async listMemberships(userId: string): Promise<StoreMembership[]> {
    const { data, error } = await this.client
      .from('store_members')
      .select('store_id, role, active, stores!inner(id, name)')
      .eq('user_id', userId)
      .eq('active', true);
    if (error) throw new AppError(error.message, 'AUTH_MEMBERSHIP_FAILED');
    return parseMembershipRows(data);
  }

  async createOwnerStore(storeName: string): Promise<StoreMembership[]> {
    const { error } = await this.client.rpc('create_store_with_owner', {
      p_store_name: storeName,
    });
    if (error) throw new AppError(error.message, 'AUTH_STORE_CREATION_FAILED');

    const user = await this.getVerifiedUser();
    if (!user) throw new AppError('No authenticated user is available.', 'AUTH_SESSION_REQUIRED');
    return this.listMemberships(user.id);
  }

  async registerDevice(
    userId: string,
    membership: StoreMembership,
    deviceId: string,
  ): Promise<void> {
    const { data: existing, error: readError } = await this.client
      .from('devices')
      .select('revoked_at')
      .eq('device_key', deviceId)
      .eq('user_id', userId)
      .eq('store_id', membership.storeId)
      .maybeSingle();
    if (readError) throw new AppError(readError.message, 'AUTH_DEVICE_LOOKUP_FAILED');
    if (existing?.revoked_at) {
      throw new AppError('This device has been revoked for the selected store.', 'AUTH_DEVICE_REVOKED');
    }

    const { error } = await this.client.from('devices').upsert({
      device_key: deviceId,
      user_id: userId,
      store_id: membership.storeId,
      name: getDeviceName(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'store_id,user_id,device_key' });
    if (error) throw new AppError(error.message, 'AUTH_DEVICE_REGISTRATION_FAILED');
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw new AppError(error.message, 'AUTH_SIGN_OUT_FAILED');
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): () => void {
    const { data } = this.client.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  }
}
