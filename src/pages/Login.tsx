import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Eye, EyeOff, Lock, Mail, Store as StoreIcon } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, status, user } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first(), []);
  const appName = storeSettings?.applicationName || 'Tindahan Manager';

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(from, { replace: true });
    }
  }, [status, user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email/username and password.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email, password });
      showToast('Logged in successfully!', 'success');
      navigate(from, { replace: true });
    } catch (err: any) {
      showToast(err.message || 'Login failed. Please check credentials.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (role: 'admin' | 'employee') => {
    const creds = role === 'admin' 
      ? { email: 'admin@tindahan.ph', password: 'admin123' }
      : { email: 'employee@tindahan.ph', password: 'employee123' };
    
    setEmail(creds.email);
    setPassword(creds.password);
    
    try {
      setIsSubmitting(true);
      await login(creds);
      showToast(`Logged in as ${role}!`, 'success');
      navigate(from, { replace: true });
    } catch (err: any) {
      showToast(err.message || 'Quick login failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <StoreIcon className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary tracking-tight">{appName}</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your store account to continue</p>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  required
                  autoFocus
                  className="pl-9"
                  placeholder="admin@tindahan.ph"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="pl-9 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Quick Dev Login Switcher */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="text-xs text-center text-muted-foreground font-medium uppercase tracking-wider">
              Quick Dev Access
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickLogin('admin')}>
                Admin Demo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickLogin('employee')}>
                Employee Demo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
