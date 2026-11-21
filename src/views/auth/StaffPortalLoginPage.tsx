"use client";
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { homeFor, useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';

export function StaffPortalLoginPage() {
  const { me, signInWithStaffKey } = useAuth();
  const navigate = useNavigate();
  const [accessKey, setAccessKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me && (me.role === 'authority' || me.role === 'admin')) {
    return <Navigate to={homeFor(me.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accessKey.trim();
    if (!trimmed) {
      setError('Enter your portal access key.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const account = await signInWithStaffKey(trimmed);
      toast.success(`Signed in as ${account.name}`);
      navigate(homeFor(account.role), { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid portal access key.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ai-bg)] px-3 py-1 text-xs font-medium text-[var(--ai)]">
          <ShieldCheck aria-hidden className="size-3.5" />
          Restricted Staff Access
        </div>
        <h1 className="text-2xl font-semibold">Portal Access</h1>
        <p className="text-sm text-[var(--ink-2)]">
          Enter your assigned department or administrator access key to continue.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="portal-key" className="mb-1 block font-medium">
            Access key
          </label>
          <div className="relative">
            <KeyRound
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-2)]"
            />
            <input
              id="portal-key"
              type="password"
              autoComplete="off"
              value={accessKey}
              onChange={(e) => {
                setAccessKey(e.target.value);
                setError(null);
              }}
              placeholder="Enter portal key"
              aria-invalid={!!error}
              aria-describedby={error ? 'portal-key-err' : undefined}
              className="w-full rounded-xl border border-[var(--line)] bg-white py-3 pl-10 pr-4 text-[var(--ink)] aria-[invalid=true]:border-[var(--crit)]"
            />
          </div>
          {error && (
            <p id="portal-key-err" role="alert" className="mt-1 text-sm text-[var(--crit)]">
              {error}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Unlock portal
        </Button>
      </form>

      <Toaster position="top-center" richColors closeButton />
    </main>
  );
}
