"use client";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { toast, Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, updateProfile,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { homeFor, useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';

const base = z.object({ email: z.string().trim().email('errors.email'), password: z.string().min(8, 'errors.password') });
const loginSchema = base.extend({ name: z.string().optional() });
const registerSchema = base.extend({ name: z.string().trim().min(2, 'errors.name') });
type Values = z.infer<typeof registerSchema>;

const field = 'w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] aria-[invalid=true]:border-[var(--crit)]';

const errorKey = (e: unknown) => {
  switch ((e as { code?: string }).code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'errors.invalid';
    case 'auth/email-already-in-use': return 'errors.exists';
    case 'auth/weak-password': return 'errors.password';
    case 'auth/network-request-failed': return 'errors.network';
    case 'auth/popup-closed-by-user': return '';
    default: return 'errors.generic';
  }
};

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation('auth');
  const { me } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const isRegister = mode === 'register';
  const {
    register, handleSubmit, getValues, trigger,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema) as unknown as Resolver<Values>,
    defaultValues: { name: '', email: '', password: '' },
  });

  if (me) return <Navigate to={me.role === 'citizen' ? (from ?? '/') : homeFor(me.role)} replace />;

  const fail = (e: unknown) => { const k = errorKey(e); if (k) toast.error(t(k)); };
  const msg = (k?: string) => (k ? t(k) : undefined);

  const submit = handleSubmit(async (v) => {
    try {
      if (isRegister) {
        const c = await createUserWithEmailAndPassword(auth, v.email, v.password);
        await updateProfile(c.user, { displayName: v.name });
        await c.user.getIdToken(true); // refresh so the backend sees the name on first sign-in
      } else {
        await signInWithEmailAndPassword(auth, v.email, v.password);
      }
    } catch (e) { fail(e); }
  });

  const google = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { fail(e); } };

  const forgot = async () => {
    if (!(await trigger('email'))) return;
    const email = getValues('email');
    try { await sendPasswordResetEmail(auth, email); } catch { /* same message either way: don't reveal which emails exist */ }
    toast.success(t('resetSent', { email }));
  };

  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <header>
        <p className="font-semibold">CivicResolve</p>
        <h1 className="mt-2 text-2xl font-semibold">{t(isRegister ? 'register' : 'signIn')}</h1>
        <p className="mt-1 text-[var(--ink-2)]">{t(isRegister ? 'subtitleRegister' : 'subtitleLogin')}</p>
      </header>

      <form onSubmit={submit} noValidate className="space-y-4">
        {isRegister && (
          <div>
            <label htmlFor="name" className="mb-1 block font-medium">{t('name')}</label>
            <input id="name" autoComplete="name" className={field} aria-invalid={!!errors.name} aria-describedby="name-err" {...register('name')} />
            <p id="name-err" role="alert" className="mt-1 text-sm text-[var(--crit)]">{msg(errors.name?.message)}</p>
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block font-medium">{t('email')}</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" className={field} aria-invalid={!!errors.email} aria-describedby="email-err" {...register('email')} />
          <p id="email-err" role="alert" className="mt-1 text-sm text-[var(--crit)]">{msg(errors.email?.message)}</p>
        </div>
        <div>
          <label htmlFor="pw" className="mb-1 block font-medium">{t('password')}</label>
          <input id="pw" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} className={field} aria-invalid={!!errors.password} aria-describedby="pw-hint pw-err" {...register('password')} />
          {isRegister && <p id="pw-hint" className="mt-1 text-sm text-[var(--ink-2)]">{t('passwordHint')}</p>}
          <p id="pw-err" role="alert" className="mt-1 text-sm text-[var(--crit)]">{msg(errors.password?.message)}</p>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{t(isRegister ? 'register' : 'signIn')}</Button>
        {!isRegister && <Button type="button" intent="ghost" className="w-full" onClick={forgot}>{t('forgot')}</Button>}
      </form>

      {/* Popup sign-in doesn't work inside the native app webview, so Google is web-only for now. */}
      {!Capacitor.isNativePlatform() && (
        <div className="space-y-3">
          <p className="text-center text-sm text-[var(--ink-2)]">{t('or')}</p>
          <Button type="button" intent="secondary" size="lg" className="w-full" onClick={google}>{t('google')}</Button>
        </div>
      )}

      <p className="text-center text-[var(--ink-2)]">
        {t(isRegister ? 'haveAccount' : 'noAccount')}{' '}
        <Link to={isRegister ? '/login' : '/register'} className="font-medium text-[var(--ink)] underline">{t(isRegister ? 'signIn' : 'register')}</Link>
      </p>
      <Toaster position="top-center" richColors closeButton />
    </main>
  );
}
