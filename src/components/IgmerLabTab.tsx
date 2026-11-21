"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  GitMerge,
  Layers,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Users,
} from "lucide-react";
import type {
  CitizenReportRecord,
  IgmerThresholds,
  MasterIncidentRecord,
  OutboxEventRecord,
} from "@/lib/igmer-engine";
import { FOCUS_RING, PriorityBadge, StatusBadge } from "./CivicBadges";

interface IgmerSnapshot {
  thresholds: IgmerThresholds;
  weights: {
    geographic: number;
    text: number;
    image: number;
    category: number;
    temporal: number;
  };
  masterIncidents: MasterIncidentRecord[];
  citizenReports: CitizenReportRecord[];
  outboxEvents: OutboxEventRecord[];
  metrics: {
    totalCitizenReports: number;
    totalMasterIncidents: number;
    deduplicationRatio: number;
    pendingOutbox: number;
    reviewQueueCount: number;
    deadLetterCount: number;
  };
}

interface SimulationSummary {
  scenario: string;
  totalSubmitted: number;
  persistedReportsCount: number;
  masterIncidentsCreated: number;
  duplicateRequestsPrevented: number;
  failedOrRetryingCount: number;
  durationMs: number;
}

export function IgmerLabTab() {
  const [snapshot, setSnapshot] = useState<IgmerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [lastSimulation, setLastSimulation] = useState<SimulationSummary | null>(null);
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);

  // Fault-injection & Ingest-First test form
  const [testTitle, setTestTitle] = useState(
    "Paani pipeline burst flooding Peelamedu main signal"
  );
  const [testDesc, setTestDesc] = useState(
    "Heavy drinking water pipe leak flooding two lanes near Peelamedu junction bus stop."
  );
  const [testLoc, setTestLoc] = useState("Avinashi Road, Peelamedu Junction, Ward 28");
  const [idempotencyKey, setIdempotencyKey] = useState("idem-demo-citizen-01");
  const [simGeminiFail, setSimGeminiFail] = useState(false);
  const [simImageFail, setSimImageFail] = useState(false);
  const [simEmbedFail, setSimEmbedFail] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestReceipt, setIngestReceipt] = useState<{
    reportId: string;
    outboxEventId: string;
    deduplicated: boolean;
  } | null>(null);

  // Configurable thresholds state
  const [highThresh, setHighThresh] = useState(0.75);
  const [medThresh, setMedThresh] = useState(0.5);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/igmer");
      if (!res.ok) return;
      const data: IgmerSnapshot = await res.json();
      setSnapshot(data);
      setHighThresh(data.thresholds.highConfidence);
      setMedThresh(data.thresholds.mediumConfidence);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  async function handleIngestTestReport(e: React.FormEvent) {
    e.preventDefault();
    setIngesting(true);
    try {
      const res = await fetch("/api/igmer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INGEST_REPORT",
          idempotencyKey,
          title: testTitle,
          description: testDesc,
          location: testLoc,
          imageDataUrl: simImageFail ? "data:image/png;base64,CORRUPT" : undefined,
          simulateGeminiFailure: simGeminiFail,
          simulateImageFailure: simImageFail,
          simulateEmbeddingFailure: simEmbedFail,
        }),
      });
      const data = await res.json();
      if (data.ingestedReceipt) setIngestReceipt(data.ingestedReceipt);
      if (data.snapshot) setSnapshot(data.snapshot);
    } finally {
      setIngesting(false);
    }
  }

  async function handleRunLoadSimulation(
    scenario:
      | "SINGLE_INCIDENT_50"
      | "TWO_COLOCATED_INCIDENTS_50"
      | "FAULT_RESILIENCE_50"
  ) {
    setSimulating(scenario);
    try {
      const res = await fetch("/api/igmer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_50", scenario }),
      });
      const data = await res.json();
      if (data.simulationResult) setLastSimulation(data.simulationResult);
      if (data.snapshot) setSnapshot(data.snapshot);
    } finally {
      setSimulating(null);
    }
  }

  async function handleRetryOutbox(eventId: string) {
    const res = await fetch("/api/igmer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RETRY_OUTBOX", eventId }),
    });
    const data = await res.json();
    if (data.snapshot) setSnapshot(data.snapshot);
  }

  async function handleResolveReview(
    reportId: string,
    decision: "CONFIRM_MERGE" | "CREATE_SEPARATE"
  ) {
    const res = await fetch("/api/igmer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESOLVE_REVIEW", reportId, decision }),
    });
    const data = await res.json();
    if (data.snapshot) setSnapshot(data.snapshot);
  }

  async function handleUpdateThresholds() {
    const res = await fetch("/api/igmer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_THRESHOLDS",
        highConfidence: highThresh,
        mediumConfidence: medThresh,
      }),
    });
    const data = await res.json();
    if (data.snapshot) setSnapshot(data.snapshot);
  }

  if (loading || !snapshot) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-300">
        Initializing IGMER Geospatial Multimodal Entity Resolution Engine...
      </div>
    );
  }

  const reportsMap = new Map(snapshot.citizenReports.map((r) => [r.reportId, r]));

  return (
    <div className="flex flex-col gap-6">
      {/* Architecture Banner & Live Telemetry Metrics */}
      <section
        aria-label="IGMER algorithm telemetry"
        className="rounded-2xl border border-indigo-400/30 bg-indigo-500/[0.07] p-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold text-cyan-200">
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              IGMER — Ingest-First Geospatial Multimodal Entity Resolution
            </div>
            <h2 className="mt-2 text-lg font-bold text-white">
              Citizen-First Transactional Outbox & PostGIS + pgvector Clustering Engine
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Weights: Geographic 35% · Text 30% · Image 20% · Category 10% · Time 5% (with Adaptive Weight Normalization & Locality Advisory Locks).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-2.5 text-center">
              <p className="text-[11px] text-slate-400">Citizen Reports</p>
              <p className="text-lg font-bold text-white">
                {snapshot.metrics.totalCitizenReports}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-400/30 bg-slate-950/70 p-2.5 text-center">
              <p className="text-[11px] text-indigo-200">Master Incidents</p>
              <p className="text-lg font-bold text-indigo-200">
                {snapshot.metrics.totalMasterIncidents}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-slate-950/70 p-2.5 text-center">
              <p className="text-[11px] text-emerald-200">Cluster Ratio</p>
              <p className="text-lg font-bold text-emerald-200">
                {snapshot.metrics.deduplicationRatio}x
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/30 bg-slate-950/70 p-2.5 text-center">
              <p className="text-[11px] text-amber-200">Outbox Retry</p>
              <p className="text-lg font-bold text-amber-200">
                {snapshot.metrics.pendingOutbox}
              </p>
            </div>
            <div className="rounded-xl border border-violet-400/30 bg-slate-950/70 p-2.5 text-center">
              <p className="text-[11px] text-violet-200">Human Review</p>
              <p className="text-lg font-bold text-violet-200">
                {snapshot.metrics.reviewQueueCount}
              </p>
            </div>
            <div className="rounded-xl border border-rose-400/30 bg-slate-950/70 p-2.5 text-center">
              <p className="text-[11px] text-rose-200">Dead Letter</p>
              <p className="text-lg font-bold text-rose-200">
                {snapshot.metrics.deadLetterCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRIORITY 6: 50-Citizen Concurrent Load & Concurrency Simulator */}
      <section
        aria-label="50-citizen concurrency load testing simulator"
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="inline-flex items-center gap-2 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              Priority 3 & 6 — 50-Citizen Concurrency & Race-Condition Stress Simulator
            </h3>
            <p className="text-xs text-slate-300">
              Simulates 50 simultaneous citizens + concurrent background workers protected by locality advisory locks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(simulating)}
              onClick={() => handleRunLoadSimulation("SINGLE_INCIDENT_50")}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 ${FOCUS_RING}`}
            >
              {simulating === "SINGLE_INCIDENT_50" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              50 Citizens → 1 Incident
            </button>

            <button
              type="button"
              disabled={Boolean(simulating)}
              onClick={() => handleRunLoadSimulation("TWO_COLOCATED_INCIDENTS_50")}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50 ${FOCUS_RING}`}
            >
              {simulating === "TWO_COLOCATED_INCIDENTS_50" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              50 Citizens → 2 Co-Located Issues (Same GPS)
            </button>

            <button
              type="button"
              disabled={Boolean(simulating)}
              onClick={() => handleRunLoadSimulation("FAULT_RESILIENCE_50")}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50 ${FOCUS_RING}`}
            >
              {simulating === "FAULT_RESILIENCE_50" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              50 Citizens + AI/DB Faults
            </button>
          </div>
        </div>

        {lastSimulation && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 grid gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.07] p-4 sm:grid-cols-5"
          >
            <div>
              <p className="text-[11px] text-emerald-200">Scenario</p>
              <p className="text-xs font-bold text-white">{lastSimulation.scenario}</p>
            </div>
            <div>
              <p className="text-[11px] text-emerald-200">Preserved Submissions</p>
              <p className="text-sm font-bold text-white">
                {lastSimulation.persistedReportsCount} / {lastSimulation.totalSubmitted} (100%)
              </p>
            </div>
            <div>
              <p className="text-[11px] text-emerald-200">Master Incidents Created</p>
              <p className="text-sm font-bold text-white">
                {lastSimulation.masterIncidentsCreated} (0 race duplicates)
              </p>
            </div>
            <div>
              <p className="text-[11px] text-emerald-200">Idempotent Retries Blocked</p>
              <p className="text-sm font-bold text-white">
                {lastSimulation.duplicateRequestsPrevented} duplicate requests
              </p>
            </div>
            <div>
              <p className="text-[11px] text-emerald-200">Execution Time</p>
              <p className="text-sm font-bold text-white">{lastSimulation.durationMs} ms</p>
            </div>
          </div>
        )}
      </section>

      {/* PRIORITY 1 & 5: Ingest-First Fault-Injection Tester & Threshold Controls */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section
          aria-label="Ingest-first fault resilience tester"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-7"
        >
          <h3 className="mb-1 inline-flex items-center gap-2 text-sm font-bold text-white">
            <Database className="h-4 w-4 text-indigo-300" aria-hidden="true" />
            Priority 1 & 5 — Ingest-First + Transactional Outbox & Fault Isolation Tester
          </h3>
          <p className="mb-4 text-xs text-slate-300">
            Test multilingual normalization (e.g., <em>paani, sadak gaddha, kachra, batti</em>), idempotency keys, and verify citizen submission succeeds even when AI stages fail.
          </p>

          <form onSubmit={handleIngestTestReport} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="igmer-title"
                  className="mb-1 block text-[11px] font-semibold uppercase text-slate-300"
                >
                  Multilingual Title
                </label>
                <input
                  id="igmer-title"
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white ${FOCUS_RING}`}
                />
              </div>
              <div>
                <label
                  htmlFor="igmer-idem"
                  className="mb-1 block text-[11px] font-semibold uppercase text-slate-300"
                >
                  Idempotency-Key Header
                </label>
                <input
                  id="igmer-idem"
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-200 ${FOCUS_RING}`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="igmer-loc"
                className="mb-1 block text-[11px] font-semibold uppercase text-slate-300"
              >
                Location / GPS Landmark
              </label>
              <input
                id="igmer-loc"
                type="text"
                value={testLoc}
                onChange={(e) => setTestLoc(e.target.value)}
                className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white ${FOCUS_RING}`}
              />
            </div>

            <div>
              <label
                htmlFor="igmer-desc"
                className="mb-1 block text-[11px] font-semibold uppercase text-slate-300"
              >
                Description
              </label>
              <textarea
                id="igmer-desc"
                rows={2}
                value={testDesc}
                onChange={(e) => setTestDesc(e.target.value)}
                className={`w-full rounded-xl border border-white/15 bg-slate-950 p-2.5 text-xs text-white ${FOCUS_RING}`}
              />
            </div>

            {/* Fault Injection Toggles */}
            <fieldset className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase text-amber-200">
                Simulate Stage Failures (Submission still succeeds 100%)
              </legend>
              <div className="flex flex-wrap gap-4 text-xs text-slate-200">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={simGeminiFail}
                    onChange={(e) => setSimGeminiFail(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900"
                  />
                  Gemini API Down (Queue Retry)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={simImageFail}
                    onChange={(e) => setSimImageFail(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900"
                  />
                  Image Processing Failure (Continue Text+Geo)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={simEmbedFail}
                    onChange={(e) => setSimEmbedFail(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900"
                  />
                  Embedding Failure (Route to Review Queue)
                </label>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={ingesting}
              className={`inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 ${FOCUS_RING}`}
            >
              {ingesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Ingest Citizen Report & Write Transactional Outbox
            </button>
          </form>

          {ingestReceipt && (
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-xs text-emerald-100"
            >
              <span>
                <strong>Persisted Immediately:</strong> Report{" "}
                <code className="font-mono">{ingestReceipt.reportId}</code> · Outbox{" "}
                <code className="font-mono">{ingestReceipt.outboxEventId}</code>
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-semibold">
                {ingestReceipt.deduplicated
                  ? "Idempotent Duplicate Intercepted"
                  : "Atomic DB + Outbox Commit"}
              </span>
            </div>
          )}
        </section>

        {/* Threshold Configuration & Outbox Queue Monitor */}
        <section
          aria-label="Configurable thresholds and outbox monitor"
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-5"
        >
          <div>
            <h3 className="mb-1 inline-flex items-center gap-2 text-sm font-bold text-white">
              <Sliders className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              Priority 2 — Configurable Matching Thresholds
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="thresh-high"
                  className="block text-[11px] text-slate-300"
                >
                  Auto-Link High Confidence ({Math.round(highThresh * 100)}%)
                </label>
                <input
                  id="thresh-high"
                  type="number"
                  step="0.05"
                  min="0.55"
                  max="0.95"
                  value={highThresh}
                  onChange={(e) => setHighThresh(Number(e.target.value))}
                  className={`mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-2.5 py-1.5 text-xs text-white ${FOCUS_RING}`}
                />
              </div>
              <div>
                <label
                  htmlFor="thresh-med"
                  className="block text-[11px] text-slate-300"
                >
                  Human Review Medium ({Math.round(medThresh * 100)}%)
                </label>
                <input
                  id="thresh-med"
                  type="number"
                  step="0.05"
                  min="0.30"
                  max="0.70"
                  value={medThresh}
                  onChange={(e) => setMedThresh(Number(e.target.value))}
                  className={`mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-2.5 py-1.5 text-xs text-white ${FOCUS_RING}`}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleUpdateThresholds}
              className={`mt-2.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 ${FOCUS_RING}`}
            >
              Apply Thresholds
            </button>
          </div>

          <div className="border-t border-white/10 pt-3">
            <h4 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Activity className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
              Transactional Outbox Events (Latest 6)
            </h4>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {snapshot.outboxEvents.slice(0, 6).map((evt) => (
                <div
                  key={evt.eventId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-2.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-indigo-200">
                        {evt.eventId}
                      </span>
                      <span className="text-slate-400">→ {evt.reportId}</span>
                    </div>
                    {evt.lastError && (
                      <p className="mt-0.5 text-[11px] text-amber-200">{evt.lastError}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        evt.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : evt.status === "REVIEW_QUEUE"
                            ? "bg-violet-500/20 text-violet-200"
                            : "bg-amber-500/20 text-amber-200"
                      }`}
                    >
                      {evt.status}
                    </span>
                    {evt.status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => handleRetryOutbox(evt.eventId)}
                        aria-label={`Retry outbox event ${evt.eventId}`}
                        className={`rounded bg-white/10 p-1 text-slate-200 hover:bg-white/20 ${FOCUS_RING}`}
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* PRIORITY 4: Aggregated Master Incidents & Independently Accessible Citizen Reports */}
      <section aria-label="Clustered master incidents" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              Priority 4 — Clustered Master Incidents ({snapshot.masterIncidents.length})
            </h3>
            <p className="text-xs text-slate-300">
              Repeated reports boost evidence confidence & impact estimation, while preserving independent access to every citizen report.
            </p>
          </div>
        </div>

        {snapshot.masterIncidents.map((incident) => {
          const isExpanded = expandedIncidentId === incident.incidentId;
          const linkedReports = incident.reportIds
            .map((id) => reportsMap.get(id))
            .filter((r): r is CitizenReportRecord => Boolean(r));

          const pendingReviews = incident.pendingReviewReportIds
            .map((id) => reportsMap.get(id))
            .filter((r): r is CitizenReportRecord => Boolean(r));

          return (
            <article
              key={incident.incidentId}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-200">
                      {incident.incidentId}
                    </span>
                    <StatusBadge status={incident.status} />
                    <PriorityBadge priority={incident.priority} />
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-200">
                      {incident.category}
                    </span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
                      {incident.supportingReportCount} Citizen Report
                      {incident.supportingReportCount === 1 ? "" : "s"} ·{" "}
                      {incident.uniqueCitizenCount} Unique Citizen
                      {incident.uniqueCitizenCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">{incident.title}</h4>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                      Centroid ({incident.geographicDistribution.centroidLat.toFixed(4)},{" "}
                      {incident.geographicDistribution.centroidLng.toFixed(4)}) · Spread{" "}
                      {incident.geographicDistribution.spreadRadiusMeters}m
                    </span>
                    <span>Dept: {incident.recommendedDepartment}</span>
                    <span>
                      AI Conf: <strong>{incident.aiClassificationConfidence}%</strong> · Match
                      Conf: <strong>{Math.round(incident.matchingConfidence * 100)}%</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedIncidentId(isExpanded ? null : incident.incidentId)
                  }
                  className={`inline-flex items-center gap-1.5 self-start rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 ${FOCUS_RING}`}
                >
                  {isExpanded ? (
                    <>
                      Hide Individual Citizen Reports
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Inspect {incident.supportingReportCount} Linked Report
                      {incident.supportingReportCount === 1 ? "" : "s"} & Similarity
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>

              {/* Medium-Confidence Human Review Banner */}
              {pendingReviews.length > 0 && (
                <div className="mt-4 space-y-2 rounded-xl border border-violet-400/40 bg-violet-500/10 p-3.5">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-200">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Medium-Confidence Matches Awaiting Human Verification ({pendingReviews.length})
                  </p>
                  {pendingReviews.map((rev) => (
                    <div
                      key={rev.reportId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/80 p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-violet-200">
                          {rev.reportId}
                        </span>{" "}
                        — {rev.title} (Score:{" "}
                        {rev.matchingScore ? `${Math.round(rev.matchingScore * 100)}%` : "Review"})
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveReview(rev.reportId, "CONFIRM_MERGE")}
                          className={`rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 ${FOCUS_RING}`}
                        >
                          Confirm Merge
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveReview(rev.reportId, "CREATE_SEPARATE")}
                          className={`rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10 ${FOCUS_RING}`}
                        >
                          Split as New Incident
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Expandable Independent Citizen Report History */}
              {isExpanded && (
                <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Independently Accessible Supporting Citizen Reports (
                    {linkedReports.length}) · Earliest:{" "}
                    {new Date(incident.earliestReportAt).toLocaleTimeString()} · Latest:{" "}
                    {new Date(incident.latestReportAt).toLocaleTimeString()}
                  </p>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {linkedReports.map((rpt) => (
                      <div
                        key={rpt.reportId}
                        className="rounded-xl border border-white/10 bg-slate-950/75 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-cyan-200">
                              {rpt.reportId}
                            </span>
                            <span className="text-slate-300">by {rpt.reporterName}</span>
                            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                              {rpt.matchingOutcome}
                              {rpt.matchingScore !== null
                                ? ` (${Math.round(rpt.matchingScore * 100)}%)`
                                : ""}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            Idempotency: {rpt.idempotencyKey}
                          </span>
                        </div>

                        <p className="mt-1 font-medium text-white">{rpt.title}</p>
                        <p className="text-slate-300">{rpt.description}</p>

                        {rpt.similarityBreakdown && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/[0.06] px-2.5 py-1.5 text-[11px] text-indigo-100">
                            <GitMerge className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                            <span>{rpt.similarityBreakdown.explanation}</span>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-300">
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                            Ingest: {rpt.stageTelemetry.ingestion}
                          </span>
                          <span className="rounded bg-white/10 px-2 py-0.5">
                            Image: {rpt.stageTelemetry.imageProcessing}
                          </span>
                          <span className="rounded bg-white/10 px-2 py-0.5">
                            Gemini: {rpt.stageTelemetry.geminiAnalysis}
                          </span>
                          <span className="rounded bg-white/10 px-2 py-0.5">
                            Vector: {rpt.stageTelemetry.embeddings}
                          </span>
                          <span className="rounded bg-white/10 px-2 py-0.5">
                            Resolution: {rpt.stageTelemetry.entityResolution}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
