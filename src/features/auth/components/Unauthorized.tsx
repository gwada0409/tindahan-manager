import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

export function Unauthorized() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center text-destructive">
        <ShieldAlert className="w-8 h-8" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h2>
      <p className="text-muted-foreground max-w-md">
        You do not have permission to access this section. Please contact your store manager or administrator if you believe this is an error.
      </p>
      <div className="pt-2">
        <Link to="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
