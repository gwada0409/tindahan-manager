import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { requestPasswordReset, error, notice } = useAuthStore();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <p className="text-sm text-muted-foreground">Internet access is required. We will email a secure recovery link.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(error || notice) && <div role={error ? 'alert' : 'status'} aria-live="polite" className={`rounded-lg border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{error ?? notice}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="recovery-email" className="text-sm font-medium">Account email</label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="recovery-email" type="email" required autoComplete="email" autoFocus className="pl-9" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>
            <Button className="w-full" disabled={submitting}>{submitting ? 'Sending...' : 'Send recovery email'}</Button>
          </form>
          <Link to="/login" className="block text-center text-sm font-medium text-primary hover:underline">Back to sign in</Link>
        </CardContent>
      </Card>
    </main>
  );
}
