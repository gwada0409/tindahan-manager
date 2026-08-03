import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Eye, EyeOff, Lock, Mail, Store as StoreIcon, UserRound } from 'lucide-react';
import { db } from '@/db/database';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

function getReturnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/';
  const from = (state as { from?: unknown }).from;
  if (typeof from !== 'object' || from === null || !('pathname' in from)) return '/';
  return typeof (from as { pathname?: unknown }).pathname === 'string'
    ? (from as { pathname: string }).pathname
    : '/';
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, loginDevelopment, signup, status, user, error, notice } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = getReturnPath(location.state);
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first(), []);
  const appName = storeSettings?.applicationName || 'Tindahan Manager';

  useEffect(() => {
    if ((status === 'authenticated' || status === 'offline') && user) {
      navigate(from, { replace: true });
    } else if (status === 'selecting-store') {
      navigate('/select-store', { replace: true });
    }
  }, [status, user, navigate, from]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      showToast('Enter your email and password.', 'error');
      return;
    }
    if (mode === 'signup' && (!displayName || !storeName || password !== confirmPassword)) {
      showToast(
        password !== confirmPassword
          ? 'Passwords do not match.'
          : 'Display name and store name are required.',
        'error',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'signup') {
        const result = await signup({ email, password, displayName, storeName });
        showToast(
          result.requiresEmailConfirmation
            ? 'Check your email to confirm the account.'
            : 'Account created successfully.',
          'success',
        );
        if (result.requiresEmailConfirmation) setMode('signin');
      } else {
        await login({ email, password });
        showToast('Signed in successfully.', 'success');
      }
    } catch (caught) {
      showToast(getErrorMessage(caught, mode === 'signup' ? 'Signup failed.' : 'Sign-in failed.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevelopmentLogin = async (role: 'admin' | 'employee') => {
    try {
      setIsSubmitting(true);
      await loginDevelopment(role);
      showToast(`Development ${role} access enabled.`, 'success');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'Development login failed.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-muted/30 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-2 pb-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StoreIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-primary">{appName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === 'signin' ? 'Sign in to your store account' : 'Create an owner account and store'}
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {!isSupabaseConfigured && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {import.meta.env.DEV
                ? 'Cloud accounts require Supabase configuration. Local development quick access remains available below.'
                : 'Cloud accounts require Supabase configuration before sign-in.'}
            </div>
          )}
          {(error || notice) && (
            <div
              role={error ? 'alert' : 'status'}
              aria-live={error ? 'assertive' : 'polite'}
              className={`rounded-lg border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}
            >
              {error ?? notice}
            </div>
          )}

          <div className="grid grid-cols-2 rounded-lg bg-muted p-1" aria-label="Authentication mode">
            <button
              type="button"
              aria-pressed={mode === 'signin'}
              onClick={() => setMode('signin')}
              className={`min-h-11 rounded-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'signin' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === 'signup'}
              onClick={() => setMode('signup')}
              className={`min-h-11 rounded-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'signup' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="display-name" className="text-sm font-medium">Your name</label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="display-name" required autoComplete="name" className="pl-9" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="store-name" className="text-sm font-medium">Store name</label>
                  <div className="relative">
                    <StoreIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="store-name" required className="pl-9" value={storeName} onChange={(event) => setStoreName(event.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="email" type="email" required autoComplete="email" autoFocus className="pl-9" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                {mode === 'signin' && <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="pl-9 pr-11" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 min-h-9 min-w-9 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {showPassword ? <EyeOff className="mx-auto h-4 w-4" aria-hidden="true" /> : <Eye className="mx-auto h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {mode === 'signup' && <p className="text-xs text-muted-foreground">Use at least eight characters.</p>}
            </div>

            {mode === 'signup' && (
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
                <Input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
            )}

            <Button type="submit" className="w-full text-base font-semibold" disabled={isSubmitting || !isSupabaseConfigured}>
              {isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Development quick access</div>
              <p className="text-center text-xs text-muted-foreground">Local only; no password or cloud identity is created.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" disabled={isSubmitting} onClick={() => void handleDevelopmentLogin('admin')}>Admin demo</Button>
                <Button type="button" variant="outline" size="sm" disabled={isSubmitting} onClick={() => void handleDevelopmentLogin('employee')}>Staff demo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
