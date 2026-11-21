"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { BrowserRouter, useNavigate, useRoutes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initI18nSync } from "@/i18n";
import { AuthProvider } from "@/auth/AuthProvider";
import { RequireAuth } from "@/auth/guards";
import { CitizenShell } from "@/components/layout/CitizenShell";
import { extraRoutes } from "@/routes/extraRoutes";
import { HomePage } from "@/views/citizen/HomePage";
import { NearbyPage } from "@/views/citizen/NearbyPage";
import { ReportPage } from "@/views/citizen/ReportPage";
import { MyReportsPage } from "@/views/citizen/MyReportsPage";
import { ProfilePage } from "@/views/citizen/ProfilePage";
import { NotFoundPage } from "@/views/NotFoundPage";

initI18nSync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const emptySubscribe = () => () => {};

function StaffShortcutListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        navigate("/staff-login");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
  return null;
}

function AppRoutes() {
  return useRoutes([
    ...extraRoutes,
    {
      element: <CitizenShell />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "nearby", element: <NearbyPage /> },
        {
          element: <RequireAuth />,
          children: [
            { path: "report", element: <ReportPage /> },
            { path: "my-reports", element: <MyReportsPage /> },
            { path: "profile", element: <ProfilePage /> },
          ],
        },
      ],
    },
    { path: "*", element: <NotFoundPage /> },
  ]);
}

function SsrShellFallback() {
  return (
    <main id="main" className="mx-auto max-w-xl space-y-6 px-4 pb-28 pt-10">
      <header className="space-y-3">
        <p className="text-sm font-medium text-[var(--ai)]">CivicResolve · Google Gemini AI</p>
        <h1 className="text-3xl font-semibold">See a problem? Report it.</h1>
        <p className="text-lg text-[var(--ink-2)]">
          Take a photo, tell us where it is, and AI classifies urgency and routes it to the right municipal department.
        </p>
        <div className="pt-2">
          <Link
            href="/report"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--ink)] px-6 text-base font-medium text-white"
          >
            Report a problem
          </Link>
        </div>
      </header>
    </main>
  );
}

export default function CatchAllPage() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return <SsrShellFallback />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <StaffShortcutListener />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
