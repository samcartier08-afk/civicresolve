"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FilePlus2,
  Globe,
  Landmark,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CitizenNotification, CivicIssue, IssueStats } from "@/lib/civic-schemas";
import { TRANSLATIONS, type SupportedLocale } from "@/lib/i18n";
import type { AuditLogEntry } from "@/lib/security";
import { FOCUS_RING } from "@/components/CivicBadges";
import { ReportIssueTab } from "@/components/ReportIssueTab";
import { NearbyMapTab } from "@/components/NearbyMapTab";
import { TrackingDashboardTab } from "@/components/TrackingDashboardTab";
import { AdminDashboardTab } from "@/components/AdminDashboardTab";
import { CivicAssistantTab } from "@/components/CivicAssistantTab";
import { IgmerLabTab } from "@/components/IgmerLabTab";

type TabId = "report" | "nearby" | "track" | "igmer" | "admin" | "assistant";

type HealthState = {
  apiKeyConfigured: boolean;
  models: { fast: string; reasoning: string };
} | null;

const EMPTY_STATS: IssueStats = {
  total: 0,
  reported: 0,
  inProgress: 0,
  resolved: 0,
  citizenVerified: 0,
  criticalAndHigh: 0,
  resolutionRate: 0,
  byCategory: {},
  byDepartment: {},
  byWard: {},
};

export default function CivicResolveApp() {
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const t = TRANSLATIONS[locale];

  const [activeTab, setActiveTab] = useState<TabId>("report");
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [stats, setStats] = useState<IssueStats>(EMPTY_STATS);
  const [notifications, setNotifications] = useState<CitizenNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthState>(null);
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/issues?role=admin");
      if (!res.ok) return;
      const data = await res.json();
      setIssues(data.issues ?? []);
      setStats(data.stats ?? EMPTY_STATS);
      setNotifications(data.notifications ?? []);
      setAuditLogs(data.auditLogs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, [fetchIssues]);

  function handleIssueCreated(issue: CivicIssue, nextStats: IssueStats) {
    setIssues((prev) => [issue, ...prev]);
    setStats(nextStats);
    setHighlightedIssueId(issue.id);
  }

  function handleIssueUpdated(updated: CivicIssue, nextStats: IssueStats) {
    setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setStats(nextStats);
    fetchIssues();
  }

  function handleIssueDeleted(id: string, nextStats: IssueStats) {
    setIssues((prev) => prev.filter((item) => item.id !== id));
    setStats(nextStats);
  }

  const tabs: Array<{
    id: TabId;
    label: string;
    icon: typeof FilePlus2;
    badge?: number | string;
  }> = [
    { id: "report", label: t.nav.report, icon: FilePlus2 },
    { id: "nearby", label: t.nav.nearby, icon: MapPin, badge: stats.total },
    {
      id: "track",
      label: t.nav.myReports,
      icon: ClipboardList,
      badge: notifications.length > 0 ? `${stats.total} · !` : stats.total,
    },
    { id: "igmer", label: t.nav.igmerLab, icon: Cpu, badge: "50x" },
    {
      id: "admin",
      label: t.nav.authority,
      icon: ShieldCheck,
      badge: stats.reported + stats.inProgress,
    },
    { id: "assistant", label: t.nav.assistant, icon: MessageSquareText },
  ];

  return (
    <>
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white ${FOCUS_RING}`}
      >
        Skip to main content
      </a>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t.syntheticBanner}
            </div>
            <div className="flex items-center gap-2.5">
              <Landmark className="h-7 w-7 text-indigo-400" aria-hidden="true" />
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {t.appName}
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">{t.tagline}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* i18n Multilingual Selector (English / Tamil / Hindi) */}
            <div
              role="group"
              aria-label="Interface language"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-950 px-2 py-1"
            >
              <Globe className="ml-1 h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              {(
                [
                  { code: "en", label: "English" },
                  { code: "ta", label: "தமிழ்" },
                  { code: "hi", label: "हिन्दी" },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  aria-pressed={locale === lang.code}
                  onClick={() => setLocale(lang.code)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${FOCUS_RING} ${
                    locale === lang.code
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                health?.apiKeyConfigured
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/35 bg-amber-500/10 text-amber-200"
              }`}
            >
              {health?.apiKeyConfigured ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Gemini Live ({health.models.fast})
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Ingest-First Resilient Mode
                </>
              )}
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav aria-label="CivicResolve sections" className="mb-6">
          <div
            role="tablist"
            aria-label="CivicResolve workflows"
            className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${FOCUS_RING} ${
                    selected
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        selected
                          ? "bg-white/20 text-white"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active Panel */}
        <main id="main-content" className="flex-1">
          {activeTab === "report" && (
            <div id="panel-report" role="tabpanel" aria-labelledby="tab-report">
              <ReportIssueTab
                t={t}
                onIssueCreated={handleIssueCreated}
                onNavigateToTracker={(issueId) => {
                  setHighlightedIssueId(issueId);
                  setActiveTab("track");
                }}
              />
            </div>
          )}

          {activeTab === "nearby" && (
            <div id="panel-nearby" role="tabpanel" aria-labelledby="tab-nearby">
              <NearbyMapTab
                issues={issues}
                t={t}
                onSelectIssue={(issueId) => {
                  setHighlightedIssueId(issueId);
                  setActiveTab("track");
                }}
              />
            </div>
          )}

          {activeTab === "track" && (
            <div id="panel-track" role="tabpanel" aria-labelledby="tab-track">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-300">
                  Loading tracked civic complaints...
                </div>
              ) : (
                <TrackingDashboardTab
                  t={t}
                  issues={issues}
                  stats={stats}
                  notifications={notifications}
                  highlightedIssueId={highlightedIssueId}
                  onIssueUpdated={handleIssueUpdated}
                />
              )}
            </div>
          )}

          {activeTab === "igmer" && (
            <div id="panel-igmer" role="tabpanel" aria-labelledby="tab-igmer">
              <IgmerLabTab />
            </div>
          )}

          {activeTab === "admin" && (
            <div id="panel-admin" role="tabpanel" aria-labelledby="tab-admin">
              <AdminDashboardTab
                issues={issues}
                stats={stats}
                auditLogs={auditLogs}
                onIssueUpdated={handleIssueUpdated}
                onIssueDeleted={handleIssueDeleted}
              />
            </div>
          )}

          {activeTab === "assistant" && (
            <div id="panel-assistant" role="tabpanel" aria-labelledby="tab-assistant">
              <CivicAssistantTab />
            </div>
          )}
        </main>

        <footer className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-slate-400">
          CivicResolve — IGMER Geospatial Multimodal Entity Resolution · Google Gemini · Cloud Run & Firebase
        </footer>
      </div>
    </>
  );
}
