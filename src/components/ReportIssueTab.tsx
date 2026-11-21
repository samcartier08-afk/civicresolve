"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ImagePlus,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  CIVIC_CATEGORIES,
  type AiTriageResult,
  type CivicCategory,
  type CivicIssue,
  type IssueStats,
} from "@/lib/civic-schemas";
import { FOCUS_RING, PriorityBadge, UrgencyMeter } from "./CivicBadges";

const SAMPLE_REPORTS = [
  {
    label: "Live Wire & Broken Pole",
    title: "Damaged streetlight pole leaning with exposed electric wires",
    location: "RS Puram DB Road, Near Bus Shelter, Ward 11",
    category: "Auto" as const,
    description:
      "After last night's storm, a metal streetlight pole tilted over the sidewalk and live wires are sparking intermittently near the bus shelter where commuters wait.",
  },
  {
    label: "School Zone Pothole",
    title: "Large crater pothole causing two-wheeler accidents",
    location: "Hopes College Junction, Avinashi Road, Ward 24",
    category: "Roads & Potholes" as const,
    description:
      "A 4-foot wide deep pothole on the left lane has filled with muddy water. Two scooters skidded this morning during rush hour.",
  },
  {
    label: "Burst Water Main",
    title: "Continuous clean water leakage flooding residential street",
    location: "Saibaba Colony 3rd Cross, Ward 16",
    category: "Auto" as const,
    description:
      "A pressurized water supply joint burst near the corner valve 6 hours ago. Clean water is gushing into storm drains and nearby homes have zero water pressure.",
  },
  {
    label: "Overflowing Garbage",
    title: "Uncollected garbage pile blocking clinic entrance",
    location: "Singanallur Market Road, Ward 39",
    category: "Waste & Sanitation" as const,
    description:
      "The roadside waste bin has overflowed for 4 days with wet garbage spilling onto the road right next to a primary health clinic, causing foul odor and mosquitoes.",
  },
];

interface ReportIssueTabProps {
  onIssueCreated: (issue: CivicIssue, stats: IssueStats) => void;
  onNavigateToTracker: (issueId: string) => void;
}

export function ReportIssueTab({
  onIssueCreated,
  onNavigateToTracker,
}: ReportIssueTabProps) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [userCategory, setUserCategory] = useState<CivicCategory | "Auto">("Auto");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [triaging, setTriaging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [triagePreview, setTriagePreview] = useState<{
    triage: AiTriageResult;
    aiSource: "gemini" | "fallback";
    aiModel: string;
  } | null>(null);
  const [submittedIssue, setSubmittedIssue] = useState<CivicIssue | null>(null);

  function applySample(sample: (typeof SAMPLE_REPORTS)[number]) {
    setTitle(sample.title);
    setLocation(sample.location);
    setDescription(sample.description);
    setUserCategory(sample.category);
    setTriagePreview(null);
    setSubmittedIssue(null);
    setError(null);
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser. Please type your location.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        setLocation(`GPS (${lat}, ${lng}) — Nearby Ward`);
        setLocating(false);
      },
      () => {
        setError("Unable to access GPS location. Please type a street name or landmark.");
        setLocating(false);
      },
      { timeout: 6000 }
    );
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError("Please upload an image smaller than 6 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const [header, base64] = dataUrl.split(",");
      const mimeMatch = header.match(/data:(.*);base64/);
      setImagePreview(dataUrl);
      setImageBase64(base64 || null);
      setImageMimeType(mimeMatch?.[1] || file.type || "image/png");
      setTriagePreview(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImagePreview(null);
    setImageBase64(null);
    setImageMimeType(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePreviewAi() {
    if (title.trim().length < 3 || description.trim().length < 10 || location.trim().length < 3) {
      setError("Please fill in title, location, and a brief description (10+ characters) first.");
      return;
    }

    setTriaging(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          userCategory,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI classification failed.");

      setTriagePreview({
        triage: data.triage,
        aiSource: data.aiSource,
        aiModel: data.aiModel,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze complaint.");
    } finally {
      setTriaging(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || description.trim().length < 10 || location.trim().length < 3) {
      setError("Please complete the title, location, and description before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmittedIssue(null);

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          reporterName: reporterName.trim() || undefined,
          userCategory,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
          imageDataUrl: imagePreview || undefined,
          precomputedTriage: triagePreview?.triage,
          aiSource: triagePreview?.aiSource,
          aiModel: triagePreview?.aiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit civic issue.");

      const created: CivicIssue = data.issue;
      setSubmittedIssue(created);
      setTriagePreview({
        triage: {
          category: created.category,
          priority: created.priority,
          urgencyScore: created.urgencyScore,
          recommendedDepartment: created.recommendedDepartment,
          publicImpactReason: created.publicImpactReason,
          citizenSummary: created.citizenSummary,
          estimatedResolutionWindow: created.estimatedResolutionWindow,
          recommendedActions: created.recommendedActions,
          safetyAdvisory: created.safetyAdvisory,
          confidence: created.confidence,
        },
        aiSource: created.aiSource,
        aiModel: created.aiModel,
      });

      onIssueCreated(created, data.stats);

      // Clear form fields so citizen can submit another issue cleanly
      setTitle("");
      setLocation("");
      setDescription("");
      setReporterName("");
      setUserCategory("Auto");
      clearImage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: Citizen Submission Form */}
      <section
        aria-label="Submit a civic issue"
        className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 lg:col-span-7"
      >
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            Quick Demo Scenarios (1-Click Fill)
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_REPORTS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => applySample(sample)}
                className={`rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:border-indigo-400/50 hover:bg-indigo-500/15 ${FOCUS_RING}`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label
              htmlFor="issue-title"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Issue Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="issue-title"
              type="text"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Deep pothole near school gate or overflowing garbage bin"
              className={`w-full rounded-xl border border-white/15 bg-slate-950/75 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="issue-location"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Location / Ward <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  id="issue-location"
                  type="text"
                  required
                  maxLength={200}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Street, landmark, or ward no."
                  className={`w-full rounded-xl border border-white/15 bg-slate-950/75 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
                />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  aria-label="Use current GPS location"
                  title="Use GPS location"
                  className={`shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 text-slate-200 transition hover:bg-white/10 ${FOCUS_RING}`}
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="issue-category"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Category
              </label>
              <select
                id="issue-category"
                value={userCategory}
                onChange={(e) => setUserCategory(e.target.value as CivicCategory | "Auto")}
                className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white ${FOCUS_RING}`}
              >
                <option value="Auto">Auto-Detect with Gemini AI</option>
                {CIVIC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="issue-description"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Detailed Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="issue-description"
              rows={4}
              required
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, how long it has persisted, and any immediate safety hazards for pedestrians or traffic..."
              className={`w-full rounded-xl border border-white/15 bg-slate-950/75 p-3.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reporter-name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Your Name (Optional)
              </label>
              <input
                id="reporter-name"
                type="text"
                maxLength={80}
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Anonymous Citizen"
                className={`w-full rounded-xl border border-white/15 bg-slate-950/75 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Photo Evidence (Optional)
              </span>
              <input
                ref={fileInputRef}
                id="civic-image-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Upload optional photo of the civic issue"
                onChange={handleImageUpload}
                className="hidden"
              />
              {imagePreview ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Uploaded civic issue preview"
                      className="h-7 w-7 rounded object-cover"
                    />
                    <span className="truncate text-xs text-indigo-100">
                      Image attached for Gemini Vision
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearImage}
                    aria-label="Remove attached photo"
                    className={`rounded-lg p-1 text-rose-200 hover:bg-rose-500/20 ${FOCUS_RING}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:border-indigo-400/50 hover:bg-white/5 ${FOCUS_RING}`}
                >
                  <ImagePlus className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                  Upload Photo for AI Vision
                </button>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              disabled={triaging || submitting}
              onClick={handlePreviewAi}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {triaging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Analyzing with Gemini...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Preview AI Triage
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={submitting || triaging}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting & Routing...
                </>
              ) : (
                <>
                  Submit Civic Report
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Right: Live Gemini AI Classification & Confirmation Panel */}
      <section
        aria-label="Gemini AI classification result"
        aria-live="polite"
        className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 lg:col-span-5"
      >
        {submittedIssue && (
          <div
            role="status"
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Report Submitted: {submittedIssue.id}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-emerald-100/90">
              Routed to <strong>{submittedIssue.recommendedDepartment}</strong> with{" "}
              <strong>{submittedIssue.priority}</strong> priority.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToTracker(submittedIssue.id)}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 ${FOCUS_RING}`}
            >
              Track {submittedIssue.id} Live
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {!triagePreview && !triaging && !submitting && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3">
              <Sparkles className="h-7 w-7 text-indigo-300" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-white">
              Gemini AI Triage Engine
            </h2>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-300">
              Click a quick demo scenario or enter a complaint to see instant AI categorization,
              urgency scoring, department routing, and crew dispatch steps.
            </p>
          </div>
        )}

        {(triaging || submitting) && (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-slate-200"
          >
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" aria-hidden="true" />
            <p className="text-sm font-medium">
              {submitting
                ? "Running Gemini triage & registering complaint..."
                : "Analyzing civic impact & routing department..."}
            </p>
          </div>
        )}

        {triagePreview && !triaging && !submitting && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-white">AI Triage Assessment</h2>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
                {triagePreview.aiSource === "gemini"
                  ? `Gemini (${triagePreview.aiModel})`
                  : "Offline Fallback"}
                {" · "}
                {triagePreview.triage.confidence}% conf.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={triagePreview.triage.priority} />
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-200">
                {triagePreview.triage.category}
              </span>
            </div>

            <UrgencyMeter score={triagePreview.triage.urgencyScore} />

            <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-200">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Recommended Department
              </div>
              <p className="mt-1 text-sm font-bold text-white">
                {triagePreview.triage.recommendedDepartment}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-200">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Est. Resolution: {triagePreview.triage.estimatedResolutionWindow}
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
                Impact Reasoning
              </h3>
              <p className="text-xs leading-relaxed text-slate-200">
                {triagePreview.triage.publicImpactReason}
              </p>
            </div>

            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                Recommended Crew Actions
              </h3>
              <ul className="space-y-1.5">
                {triagePreview.triage.recommendedActions.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-slate-950/60 p-2 text-xs text-slate-200"
                  >
                    <span className="font-bold text-indigo-300">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span>
                <strong>Citizen Safety Advisory:</strong> {triagePreview.triage.safetyAdvisory}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
