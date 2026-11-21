"use client";
import type { RouteObject } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthPage } from '../views/auth/AuthPage';
import { RequireRole } from '../auth/guards';
import { StaffShell } from '../components/layout/StaffShell';
import { IncidentsPage } from '../views/staff/IncidentsPage';
import { IncidentDetailPage } from '../views/staff/IncidentDetailPage';
import { AdminOverviewPage } from '../views/staff/AdminOverviewPage';

function AuthorityLayout() {
  const { t } = useTranslation('portal');
  return <StaffShell title={t('authority')} nav={[{ to: '/authority', label: t('queue'), end: false }]} />;
}
function AdminLayout() {
  const { t } = useTranslation('portal');
  return <StaffShell title={t('admin')} nav={[{ to: '/admin', label: t('overview'), end: true }, { to: '/admin/incidents', label: t('allIncidents') }]} />;
}

/** Spread into your existing router. Existing citizen routes are untouched. */
export const extraRoutes: RouteObject[] = [
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/register', element: <AuthPage mode="register" /> },
  {
    element: <RequireRole roles={['authority', 'admin']} />,
    children: [{
      path: '/authority', element: <AuthorityLayout />,
      children: [{ index: true, element: <IncidentsPage /> }, { path: ':id', element: <IncidentDetailPage /> }],
    }],
  },
  {
    element: <RequireRole roles={['admin']} />,
    children: [{
      path: '/admin', element: <AdminLayout />,
      children: [
        { index: true, element: <AdminOverviewPage /> },
        { path: 'incidents', element: <IncidentsPage /> },
        { path: 'incidents/:id', element: <IncidentDetailPage /> },
      ],
    }],
  },
];
