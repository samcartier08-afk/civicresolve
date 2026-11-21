"use client";

import { useState } from "react";
import { Flame, List, Map as MapIcon, MapPin, Users } from "lucide-react";
import type { CivicIssue } from "@/lib/civic-schemas";
import type { UiTranslations } from "@/lib/i18n";
import { FOCUS_RING, PriorityBadge, StatusBadge } from "./CivicBadges";

interface NearbyMapTabProps {
  issues: CivicIssue[];
  t: UiTranslations;
  onSelectIssue: (issueId: string) => void;
}

export function NearbyMapTab({ issues, t, onSelectIssue }: NearbyMapTabProps) {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [selectedPin, setSelectedPin] = useState<CivicIssue | null>(issues[0] ?? null);

  // Normalize lat/lng into viewport % coordinates for the interactive spatial canvas
  // plus embedded OpenStreetMap tile view for the selected incident
  const lats = issues.map((i) => i.latitude || 13.05);
  const lngs = issues.map((i) => i.longitude || 80.24);
  const minLat = Math.min(...lats, 12.89) - 0.02;
  const maxLat = Math.max(...lats, 13.1) + 0.02;
  const minLng = Math.min(...lngs, 80.2) - 0.02;
  const maxLng = Math.max(...lngs, 80.28) + 0.02;

  function toViewportPercent(lat: number, lng: number) {
    const y = 100 - ((lat - minLat) / Math.max(0.001, maxLat - minLat)) * 80 - 10;
    const x = ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * 80 + 10;
    return {
      left: `${Math.min(90, Math.max(10, x))}%`,
      top: `${Math.min(88, Math.max(12, y))}%`,
    };
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Controls & WCAG Accessible View Switcher */}
      <section
        aria-label="Map and accessible list view controls"
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-base font-bold text-white">{t.nearby.heading}</h2>
          <p className="text-xs text-slate-300">
            Every spatial view includes a full keyboard- and screen-reader-accessible list alternative.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showHeatmap}
            onClick={() => setShowHeatmap((v) => !v)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${FOCUS_RING} ${
              showHeatmap
                ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                : "border-white/15 bg-white/5 text-slate-200"
            }`}
          >
            <Flame className="h-4 w-4 text-amber-300" aria-hidden="true" />
            {t.nearby.heatmapToggle}
          </button>

          <div
            role="group"
            aria-label="Choose spatial map or accessible list view"
            className="inline-flex rounded-xl border border-white/15 bg-slate-950 p-1"
          >
            <button
              type="button"
              aria-pressed={viewMode === "map"}
              onClick={() => setViewMode("map")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${FOCUS_RING} ${
                viewMode === "map"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.nearby.mapView}
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${FOCUS_RING} ${
                viewMode === "list"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              {t.nearby.listView}
            </button>
          </div>
        </div>
      </section>

      {viewMode === "map" ? (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Interactive Spatial Cluster & Heatmap Canvas + OSM Frame */}
          <section
            aria-label="Interactive civic incident cluster map"
            className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-4 lg:col-span-8"
          >
            {/* Subtle Coordinate Grid Backdrop */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />

            <div className="relative z-10 mb-2 flex items-center justify-between text-xs text-slate-300">
              <span className="rounded-lg bg-slate-900/90 px-2.5 py-1 font-mono">
                PostGIS SRID 4326 · Chennai / Tamil Nadu Cluster Grid
              </span>
              <span className="rounded-lg bg-slate-900/90 px-2.5 py-1">
                {issues.length} Master Incidents Plotted
              </span>
            </div>

            <div className="relative h-[350px] w-full">
              {issues.map((issue) => {
                const pos = toViewportPercent(issue.latitude, issue.longitude);
                const isSelected = selectedPin?.id === issue.id;
                const heatRadius = Math.min(130, 48 + issue.supportingReportCount * 16);

                const pinColor =
                  issue.priority === "Critical"
                    ? "bg-rose-500 border-rose-200 text-white"
                    : issue.priority === "High"
                      ? "bg-orange-500 border-orange-200 text-white"
                      : issue.status === "Resolved" || issue.status === "Citizen Verified"
                        ? "bg-emerald-500 border-emerald-200 text-white"
                        : "bg-indigo-500 border-indigo-200 text-white";

                return (
                  <div
                    key={issue.id}
                    style={{ left: pos.left, top: pos.top }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    {/* Heatmap Radial Aura */}
                    {showHeatmap && (
                      <div
                        aria-hidden="true"
                        style={{ width: `${heatRadius}px`, height: `${heatRadius}px` }}
                        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl ${
                          issue.priority === "Critical"
                            ? "bg-rose-500/35"
                            : issue.priority === "High"
                              ? "bg-amber-500/30"
                              : "bg-indigo-500/25"
                        }`}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedPin(issue)}
                      aria-label={`${issue.id}: ${issue.title} (${issue.priority} priority, ${issue.supportingReportCount} citizen reports)`}
                      className={`relative z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full border-2 px-3 py-1.5 text-xs font-bold shadow-lg transition-transform hover:scale-105 ${pinColor} ${
                        isSelected ? "ring-4 ring-white/40 scale-110" : ""
                      } ${FOCUS_RING}`}
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{issue.supportingReportCount}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Selected Incident Detail & OpenStreetMap Verification Panel */}
          <section
            aria-label="Selected map incident details"
            aria-live="polite"
            className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-4"
          >
            {selectedPin ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-200">
                    {selectedPin.id}
                  </span>
                  <StatusBadge status={selectedPin.status} />
                  <PriorityBadge priority={selectedPin.priority} />
                  {selectedPin.isSynthetic && (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                      Synthetic Seed
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white">{selectedPin.title}</h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  {selectedPin.description}
                </p>

                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
                  <p>
                    <strong>Location:</strong> {selectedPin.location}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-cyan-200">
                    GPS: ({selectedPin.latitude.toFixed(4)}, {selectedPin.longitude.toFixed(4)}) ·{" "}
                    {selectedPin.wardCode || "Ward 101"}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-emerald-200">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Clustered from {selectedPin.supportingReportCount} citizen report
                    {selectedPin.supportingReportCount === 1 ? "" : "s"}
                  </p>
                </div>

                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedPin.latitude}&mlon=${selectedPin.longitude}#map=16/${selectedPin.latitude}/${selectedPin.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 ${FOCUS_RING}`}
                >
                  Open Coordinates in OpenStreetMap ↗
                </a>

                <button
                  type="button"
                  onClick={() => onSelectIssue(selectedPin.id)}
                  className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 ${FOCUS_RING}`}
                >
                  Inspect Full Lifecycle & Verify
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-300">
                Select any incident pin on the map to inspect its details.
              </p>
            )}
          </section>
        </div>
      ) : (
        /* Accessible List-View Alternative (WCAG 2.1 AA Requirement) */
        <section
          aria-label="Accessible list of nearby civic incidents"
          className="space-y-3"
        >
          {issues.map((issue) => (
            <article
              key={issue.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-200">
                    {issue.id}
                  </span>
                  <StatusBadge status={issue.status} />
                  <PriorityBadge priority={issue.priority} />
                  <span className="text-xs text-slate-300">
                    {issue.supportingReportCount} report
                    {issue.supportingReportCount === 1 ? "" : "s"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{issue.title}</h3>
                <p className="text-xs text-slate-300">
                  {issue.location} · GPS ({issue.latitude.toFixed(4)},{" "}
                  {issue.longitude.toFixed(4)})
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectIssue(issue.id)}
                className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 ${FOCUS_RING}`}
              >
                Open Incident
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
