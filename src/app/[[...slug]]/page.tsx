"use client";

import { useEffect, useState } from "react";
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

export default function CatchAllPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

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
