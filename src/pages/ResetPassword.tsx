import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { updatePassword, error, notice } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      navigate('/login', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <p className="text-sm text-muted-foreground">Open this page from the recovery email on the same browser.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(localError || error || notice) && <div role={localError || error ? 'alert' : 'status'} aria-live="polite" className={`rounded-lg border p-3 text-sm ${localError || error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{localError ?? error ?? notice}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><label htmlFor="new-password" className="text-sm font-medium">New password</label><Input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm new password</label><Input id="confirm-new-password" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
            <Button className="w-full" disabled={submitting}>{submitting ? 'Updating...' : 'Update password'}</Button>
          </form>
          <Link to="/login" className="block text-center text-sm font-medium text-primary hover:underline">Back to sign in</Link>
        </CardContent>
      </Card>
    </main>
  );
}
