"use client";
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { homeFor, useAuth, type Role } from './AuthProvider';
import { ErrorState, Skeleton } from '../components/ui/States';

function Pending() {
  const { t } = useTranslation();
  return <div role="status" aria-label={t('state.loading')} className="mx-auto max-w-xl p-6"><Skeleton className="h-40" /></div>;
}

/** UX guard only. The backend enforces every permission. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Pending />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, me, loading, error, retry } = useAuth();
  const { t } = useTranslation('auth');
  const loc = useLocation();
  if (loading) return <Pending />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (error || !me) return <ErrorState title={t('errors.profileTitle')} hint={t('errors.profile')} onRetry={retry} />;
  if (!roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <Outlet />;
}
