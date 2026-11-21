"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  CHENNAI_SYNTHETIC_JURISDICTIONS,
  type AiTriageResult,
  type CivicIssue,
  type IssueStats,
} from "@/lib/civic-schemas";
import type { UiTranslations } from "@/lib/i18n";
import { FOCUS_RING, PriorityBadge, UrgencyMeter } from "./CivicBadges";

const SAMPLE_REPORTS = [
  {
    label: "Exposed Live Wire (Critical)",
    title: "Damaged streetlight pole leaning with exposed electric wires",
    location: "Mylapore Luz Corner Bus Shelter, Ward 126, Chennai",
    wardCode: "GCC-W126",
    description:
      "After last night's storm, a metal streetlight pole tilted over the sidewalk and live wires are sparking intermittently near the bus shelter where commuters wait.",
  },
  {
    label: "School Zone Pothole (Tamil/English)",
    title: "Large crater sadak gaddha pothole causing two-wheeler accidents",
    location: "Pondy Bazaar Main Road, Near Govt High School, Ward 136, Chennai",
    wardCode: "GCC-W136",
    description:
      "A 4-foot wide deep pothole on the left lane has filled with muddy rainwater. Two scooters skidded this morning during school drop-off.",
  },
  {
    label: "Burst Water Main",
    title: "Continuous clean paani pipeline leakage flooding residential street",
    location: "Anna Nagar 2nd Avenue, Ward 101, Chennai",
    wardCode: "GCC-W101",
    description:
      "A pressurized drinking water supply joint burst near the corner valve 6 hours ago. Clean water is gushing into storm drains.",
  },
  {
    label: "Overflowing Garbage",
    title: "Uncollected kachra garbage pile blocking clinic entrance",
    location: "Adyar Besant Avenue Market Road, Ward 173, Chennai",
    wardCode: "GCC-W173",
    description:
      "The roadside waste bin has overflowed for 4 days with wet garbage spilling onto the road right next to a primary health clinic.",
  },
];

interface ReportIssueTabProps {
  t: UiTranslations;
  onIssueCreated: (issue: CivicIssue, stats: IssueStats) => void;
  onNavigateToTracker: (issueId: string) => void;
}

export function ReportIssueTab({
  t,
  onIssueCreated,
  onNavigateToTracker,
}: ReportIssueTabProps) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [wardCode, setWardCode] = useState("GCC-W101");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [locationConsent, setLocationConsent] = useState(true);

  // Up to 4 images with client-side EXIF-safe DataURL creation
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Optional Voice Input via Web Speech API
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

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
  const [igmerReceipt, setIgmerReceipt] = useState<{
    reportId: string;
    outboxEventId: string;
    masterIncidentId: string | null;
    matchingOutcome: string;
    matchingScore: number | null;
    supportingReportCount: number;
  } | null>(null);

  function applySample(sample: (typeof SAMPLE_REPORTS)[number]) {
    setTitle(sample.title);
    setLocation(sample.location);
    setWardCode(sample.wardCode);
    setDescription(sample.description);
    setTriagePreview(null);
    setSubmittedIssue(null);
    setError(null);
  }

  function handleToggleVoice() {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor || typeof SpeechRecognitionCtor !== "function") {
      setError(
        "Voice dictation is not supported in this browser tab. Please type your description below."
      );
      return;
    }

    try {
      const recognition = new (SpeechRecognitionCtor as new () => {
        lang: string;
        interimResults: boolean;
        onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript || "";
        if (transcript) {
          setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  function handleUseMyLocation() {
    if (!locationConsent) {
      setError("Please check the location consent box before collecting GPS coordinates.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser. Please enter a landmark.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        setLocation(`GPS (${lat}, ${lng}) — Chennai Metropolitan Ward`);
        setLocating(false);
      },
      () => {
        setError("Could not read GPS pin. Please type the street name or landmark.");
        setLocating(false);
      },
      { timeout: 6000 }
    );
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (mediaPreviews.length + files.length > 4) {
      setError("You can attach up to 4 photos per report.");
      return;
    }

    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Only JPEG, PNG, and WebP images are allowed.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Each image must be under 5 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        setMediaPreviews((prev) => [...prev, dataUrl].slice(0, 4));
        setTriagePreview(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }

  function removePhotoAt(index: number) {
    setMediaPreviews((prev) => prev.filter((_, idx) => idx !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePreviewAi() {
    if (title.trim().length < 3 || description.trim().length < 10 || location.trim().length < 3) {
      setError("Please enter a short summary, details (10+ chars), and street/landmark first.");
      return;
    }

    setTriaging(true);
    setError(null);
    try {
      const firstImage = mediaPreviews[0];
      const [header, base64] = firstImage ? firstImage.split(",") : ["", ""];
      const mimeMatch = header?.match(/data:(.*);base64/);

      const res = await fetch("/api/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          userCategory: "Auto",
          imageBase64: base64 || undefined,
          imageMimeType: mimeMatch?.[1] || undefined,
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
      setError(err instanceof Error ? err.message : "Could not preview AI routing.");
    } finally {
      setTriaging(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || description.trim().length < 10 || location.trim().length < 3) {
      setError("Please complete Step 1 (summary & details) and Step 2 (street/landmark).");
      return;
    }
    if (!locationConsent) {
      setError("Please confirm location consent so municipal crews can locate the issue.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmittedIssue(null);

    try {
      const firstImage = mediaPreviews[0];
      const [header, base64] = firstImage ? firstImage.split(",") : ["", ""];
      const mimeMatch = header?.match(/data:(.*);base64/);

      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          wardCode,
          locationConsent,
          reporterName: isAnonymous ? undefined : reporterName.trim() || undefined,
          isAnonymous,
          userCategory: "Auto",
          imageBase64: base64 || undefined,
          imageMimeType: mimeMatch?.[1] || undefined,
          imageDataUrl: firstImage || undefined,
          mediaUrls: mediaPreviews,
          precomputedTriage: triagePreview?.triage,
          aiSource: triagePreview?.aiSource,
          aiModel: triagePreview?.aiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save your report.");

      const created: CivicIssue = data.issue;
      setSubmittedIssue(created);
      if (data.igmer) {
        setIgmerReceipt(data.igmer);
      }
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

      setTitle("");
      setLocation("");
      setDescription("");
      setReporterName("");
      setMediaPreviews([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: <= 3-Step Citizen Submission Form (Citizen never needs to pick a department!) */}
      <section
        aria-label="Report a civic problem"
        className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 lg:col-span-7"
      >
        <div>
          <h2 className="text-lg font-bold text-white">{t.reportForm.heading}</h2>
          <p className="mt-1 text-xs text-slate-300">{t.reportForm.subheading}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            Quick 1-Click Sample Reports
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_REPORTS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => applySample(sample)}
                className={`min-h-[38px] rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-indigo-400/50 hover:bg-indigo-500/15 ${FOCUS_RING}`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {/* STEP 1: WHAT HAPPENED? */}
          <fieldset className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-indigo-200">
              {t.reportForm.step1Title}
            </legend>

            <div>
              <label
                htmlFor="issue-title"
                className="mb-1 block text-xs font-semibold text-slate-200"
              >
                {t.reportForm.titleLabel} <span className="text-rose-400">*</span>
              </label>
              <input
                id="issue-title"
                type="text"
                required
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.reportForm.titlePlaceholder}
                className={`min-h-[44px] w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="issue-description"
                  className="text-xs font-semibold text-slate-200"
                >
                  {t.reportForm.descriptionLabel} <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  aria-pressed={listening}
                  className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${FOCUS_RING} ${
                    listening
                      ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
                      : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {listening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                      {t.reportForm.voiceStop}
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                      {t.reportForm.voiceStart}
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="issue-description"
                rows={3}
                required
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.reportForm.descriptionPlaceholder}
                className={`w-full rounded-xl border border-white/15 bg-slate-950 p-3.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
              />
            </div>
          </fieldset>

          {/* STEP 2: WHERE IS IT? */}
          <fieldset className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-indigo-200">
              {t.reportForm.step2Location}
            </legend>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="issue-location"
                  className="mb-1 block text-xs font-semibold text-slate-200"
                >
                  {t.reportForm.landmarkLabel} <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="issue-location"
                    type="text"
                    required
                    maxLength={200}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t.reportForm.landmarkPlaceholder}
                    className={`min-h-[44px] w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
                  />
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    aria-label={t.reportForm.useGpsButton}
                    title={t.reportForm.useGpsButton}
                    className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-slate-200 transition hover:bg-white/10 ${FOCUS_RING}`}
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
                  htmlFor="issue-ward"
                  className="mb-1 block text-xs font-semibold text-slate-200"
                >
                  Municipal Ward
                </label>
                <select
                  id="issue-ward"
                  value={wardCode}
                  onChange={(e) => setWardCode(e.target.value)}
                  className={`min-h-[44px] w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-xs text-white ${FOCUS_RING}`}
                >
                  {CHENNAI_SYNTHETIC_JURISDICTIONS.map((j) => (
                    <option key={j.wardCode} value={j.wardCode}>
                      {j.wardName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={locationConsent}
                onChange={(e) => setLocationConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              <span>{t.reportForm.locationConsentLabel}</span>
            </label>
          </fieldset>

          {/* STEP 3: PHOTOS & PRIVACY */}
          <fieldset className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-indigo-200">
              {t.reportForm.step3Evidence}
            </legend>

            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-200">
                {t.reportForm.photosLabel}
              </span>
              <p className="mb-2 text-[11px] text-slate-400">{t.reportForm.photosHint}</p>

              <input
                ref={fileInputRef}
                id="civic-image-upload"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                aria-label={t.reportForm.photosLabel}
                onChange={handleImageUpload}
                className="hidden"
              />

              {mediaPreviews.length > 0 && (
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {mediaPreviews.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-xl border border-indigo-400/40 bg-slate-900 p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Uploaded evidence photo ${idx + 1} of ${mediaPreviews.length}`}
                        className="h-20 w-full rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhotoAt(idx)}
                        aria-label={`Remove evidence photo ${idx + 1}`}
                        className={`absolute right-1.5 top-1.5 rounded-md bg-slate-950/90 p-1 text-rose-200 hover:bg-rose-500/30 ${FOCUS_RING}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {mediaPreviews.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:border-indigo-400/50 hover:bg-white/5 ${FOCUS_RING}`}
                >
                  <ImagePlus className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                  Add Evidence Photo ({mediaPreviews.length}/4)
                </button>
              )}
            </div>

            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900"
                />
                <div>
                  <span className="font-semibold text-white">
                    {t.reportForm.anonymousLabel}
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {t.reportForm.anonymousHint}
                  </p>
                </div>
              </label>

              {!isAnonymous && (
                <div>
                  <label
                    htmlFor="reporter-name"
                    className="mb-1 block text-xs font-semibold text-slate-200"
                  >
                    Your Name (Optional)
                  </label>
                  <input
                    id="reporter-name"
                    type="text"
                    maxLength={80}
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Citizen Reporter"
                    className={`min-h-[44px] w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Single Primary Action ("Report a problem") + Secondary AI Preview */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={triaging || submitting}
              onClick={handlePreviewAi}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {triaging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Preview AI Routing
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={submitting || triaging}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t.reportForm.submittingButton}
                </>
              ) : (
                <>
                  {t.reportForm.submitButton}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Right: Live Gemini AI Classification & Action-Led Confirmation Panel */}
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
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t.reportForm.successHeading} Tracking ID {submittedIssue.id}
            </div>
            <p className="mt-1.5 text-xs text-emerald-100/90">
              Automatically routed to <strong>{submittedIssue.recommendedDepartment}</strong>{" "}
              ({submittedIssue.priority} priority).
            </p>

            {submittedIssue.anonymousTrackingToken && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/15 p-2.5 text-xs text-amber-100">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span>
                  {t.reportForm.anonymousTokenLabel}{" "}
                  <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono font-bold text-amber-200">
                    {submittedIssue.anonymousTrackingToken}
                  </code>
                </span>
              </div>
            )}

            {igmerReceipt && (
              <div className="mt-2.5 rounded-lg border border-emerald-400/30 bg-slate-950/60 p-2.5 text-[11px] text-emerald-100">
                <p>
                  <strong>Ingest-First Receipt:</strong> {igmerReceipt.reportId} (Outbox{" "}
                  {igmerReceipt.outboxEventId})
                </p>
                <p className="mt-0.5">
                  <strong>Incident Clustering:</strong> {igmerReceipt.matchingOutcome} → Master
                  Incident <strong>{igmerReceipt.masterIncidentId}</strong> (
                  {igmerReceipt.supportingReportCount} supporting report
                  {igmerReceipt.supportingReportCount === 1 ? "" : "s"})
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigateToTracker(submittedIssue.id)}
              className={`mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 ${FOCUS_RING}`}
            >
              Track & Verify {submittedIssue.id}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {!triagePreview && !triaging && !submitting && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3">
              <Sparkles className="h-7 w-7 text-indigo-300" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Zero-Friction AI Department Routing
            </h3>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-300">
              You never need to guess department names. Gemini classifies your report, checks for duplicate reports nearby, and routes it to the responsible crew.
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
                ? "Saving report & running background clustering..."
                : "Analyzing civic impact & routing department..."}
            </p>
          </div>
        )}

        {triagePreview && !triaging && !submitting && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">AI Routing & Triage Summary</h3>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
                {triagePreview.aiSource === "gemini"
                  ? `Gemini (${triagePreview.aiModel})`
                  : "Resilient Fallback"}
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
                Assigned Municipal Department
              </div>
              <p className="mt-1 text-sm font-bold text-white">
                {triagePreview.triage.recommendedDepartment}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-200">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Target SLA: {triagePreview.triage.estimatedResolutionWindow}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span>
                <strong>Safety Advisory:</strong> {triagePreview.triage.safetyAdvisory}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
