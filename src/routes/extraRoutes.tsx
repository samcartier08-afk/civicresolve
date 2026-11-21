"use client";
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RequireRole } from '../auth/guards';
import { StaffShell } from '../components/layout/StaffShell';
import { Skeleton } from '../components/ui/States';

// Bundle splitting: lazy-load auth & staff portal pages so citizen bundle stays lean
const AuthPage = lazy(() =>
  import('../views/auth/AuthPage').then((m) => ({ default: m.AuthPage }))
);
const StaffPortalLoginPage = lazy(() =>
  import('../views/auth/StaffPortalLoginPage').then((m) => ({
    default: m.StaffPortalLoginPage,
  }))
);
const IncidentsPage = lazy(() =>
  import('../views/staff/IncidentsPage').then((m) => ({ default: m.IncidentsPage }))
);
const IncidentDetailPage = lazy(() =>
  import('../views/staff/IncidentDetailPage').then((m) => ({ default: m.IncidentDetailPage }))
);
const AdminOverviewPage = lazy(() =>
  import('../views/staff/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage }))
);

function LazyWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Skeleton className="h-48" />}>{children}</Suspense>;
}

function AuthorityLayout() {
  const { t } = useTranslation('portal');
  return <StaffShell title={t('authority')} nav={[{ to: '/authority', label: t('queue'), end: false }]} />;
}
function AdminLayout() {
  const { t } = useTranslation('portal');
  return (
    <StaffShell
      title={t('admin')}
      nav={[
        { to: '/admin', label: t('overview'), end: true },
        { to: '/admin/incidents', label: t('allIncidents') },
      ]}
    />
  );
}

/** Spread into your router. Staff & admin chunks load on demand. */
export const extraRoutes: RouteObject[] = [
  { path: '/login', element: <LazyWrap><AuthPage mode="login" /></LazyWrap> },
  { path: '/register', element: <LazyWrap><AuthPage mode="register" /></LazyWrap> },
  { path: '/staff-login', element: <LazyWrap><StaffPortalLoginPage /></LazyWrap> },
  {
    element: <RequireRole roles={['authority', 'admin']} />,
    children: [
      {
        path: '/authority',
        element: <AuthorityLayout />,
        children: [
          { index: true, element: <LazyWrap><IncidentsPage /></LazyWrap> },
          { path: ':id', element: <LazyWrap><IncidentDetailPage /></LazyWrap> },
        ],
      },
    ],
  },
  {
    element: <RequireRole roles={['admin']} />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <LazyWrap><AdminOverviewPage /></LazyWrap> },
          { path: 'incidents', element: <LazyWrap><IncidentsPage /></LazyWrap> },
          { path: 'incidents/:id', element: <LazyWrap><IncidentDetailPage /></LazyWrap> },
        ],
      },
    ],
  },
];
