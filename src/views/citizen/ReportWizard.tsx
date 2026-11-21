"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Camera, CheckCircle2, MapPin, Mic, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';

const MAX_IMG = 4;
const MAX_MB = 5;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const reportSchema = z
  .object({
    description: z.string().trim().min(10, 'errors.descShort').max(2000),
    images: z.array(z.instanceof(File)).max(MAX_IMG),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    landmark: z.string().trim().max(120).optional(),
    anonymous: z.boolean(),
  })
  .refine((v) => v.lat !== null || (v.landmark?.length ?? 0) > 2, {
    path: ['landmark'],
    message: 'errors.needLocation',
  });
export type ReportInput = z.infer<typeof reportSchema>;

export interface ReportWizardProps {
  /** Wire to your existing submit call. The key makes retries safe (idempotent). */
  onSubmit: (data: ReportInput, idempotencyKey: string) => Promise<{ trackingId: string }>;
  /** Optional: render your existing lazy-loaded Leaflet picker here. */
  mapSlot?: (p: {
    lat: number | null;
    lng: number | null;
    onPick: (lat: number, lng: number) => void;
  }) => ReactNode;
  /** Optional extra photo sources (e.g. live camera). Receives the wizard's own add-photos handler. */
  photoExtras?: (add: (files: File[]) => void, disabled: boolean) => ReactNode;
  /** Optional: shown once at least one photo is added. Lets the caller offer ready-made descriptions. */
  photoSuggestions?: (ctx: { description: string; setDescription: (text: string) => void }) => ReactNode;
}

interface SpeechLike {
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}
const getSpeech = (): (new () => SpeechLike) | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const STEP_FIELDS: (keyof ReportInput)[][] = [['description', 'images'], ['landmark', 'lat'], ['anonymous']];
const field =
  'w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] placeholder:text-[#667085] aria-[invalid=true]:border-[var(--crit)]';

export function ReportWizard({ onSubmit, mapSlot, photoExtras, photoSuggestions }: ReportWizardProps) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const key = useRef(crypto.randomUUID());

  const {
    register, handleSubmit, setValue, getValues, watch, trigger,
    formState: { errors, isSubmitting },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { description: '', images: [], lat: null, lng: null, landmark: '', anonymous: false },
  });
  const images = watch('images');
  const lat = watch('lat');
  const lng = watch('lng');

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => headingRef.current?.focus(), [step, trackingId]);

  const msg = (k?: string) => (k ? t(k) : undefined);

  const addFiles = (list: ArrayLike<File> | null) => {
    if (!list) return;
    const next = [...images];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_IMG) { toast.error(t('errors.photoMax')); break; }
      if (!TYPES.includes(f.type)) { toast.error(t('errors.photoType')); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(t('errors.photoSize')); continue; }
      next.push(f);
    }
    setValue('images', next, { shouldValidate: true });
  };

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValue('lat', p.coords.latitude, { shouldValidate: true });
        setValue('lng', p.coords.longitude);
      },
      () => toast.error(t('errors.geo')),
      { enableHighAccuracy: true, timeout: 10_000 },
    );

  const listen = () => {
    const Speech = getSpeech();
    if (!Speech) return;
    const r = new Speech();
    r.lang = `${i18n.language}-IN`;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setValue('description', `${getValues('description')} ${text}`.trim(), { shouldValidate: true });
    };
    r.onerror = () => toast.error(t('errors.voice'));
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const next = async () => { if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1); };

  const submit = handleSubmit(async (v) => {
    try {
      const r = await onSubmit(v, key.current);
      setTrackingId(r.trackingId);
    } catch {
      toast.error(t('errors.submit')); // form data stays in place; nothing to retype
    }
  });

  if (trackingId) {
    return (
      <section role="status" className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2 aria-hidden className="size-12 text-[var(--ok)]" />
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">{t('report.doneTitle')}</h1>
        <p className="text-[var(--ink-2)]">{t('report.doneBody', { id: trackingId })}</p>
      </section>
    );
  }

  const slide = { initial: { opacity: 0, x: reduce ? 0 : 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: reduce ? 0 : -24 } };
  const titles = [t('report.step1'), t('report.step2'), t('report.step3')];

  return (
    <form
      onSubmit={submit}
      noValidate
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); }}
      className="space-y-6"
    >
      <header>
        <p className="text-sm text-[var(--ink-2)]" aria-live="polite">{t('report.stepOf', { current: step + 1, total: 3 })}</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">{titles[step]}</h1>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...slide} transition={{ type: 'spring', duration: 0.3, bounce: 0 }} className="space-y-5">
          {step === 0 && (
            <>
              <div>
                <label htmlFor="desc" className="mb-1 block font-medium">{t('report.describe')}</label>
                <textarea
                  id="desc" rows={5} className={field} {...register('description')}
                  aria-invalid={!!errors.description} aria-describedby="desc-hint desc-err"
                />
                <p id="desc-hint" className="mt-1 text-sm text-[var(--ink-2)]">{t('report.describeHint')}</p>
                <p id="desc-err" role="alert" className="mt-1 text-sm text-[var(--crit)]">{msg(errors.description?.message)}</p>
                {getSpeech() && (
                  <Button type="button" intent="secondary" onClick={listen} disabled={listening} className="mt-2">
                    <Mic aria-hidden className="size-4" />
                    {listening ? t('report.listening') : t('report.speak')}
                  </Button>
                )}
              </div>

              <div>
                <p className="mb-1 font-medium">{t('report.photos')}</p>
                <ul className="mb-2 flex flex-wrap gap-2">
                  {previews.map((src, i) => (
                    <li key={src} className="relative">
                      <img src={src} alt={t('report.photoAlt', { n: i + 1 })} width={88} height={88} className="size-[88px] rounded-xl object-cover" />
                      <button
                        type="button"
                        aria-label={t('report.removePhoto', { n: i + 1 })}
                        onClick={() => setValue('images', images.filter((_, j) => j !== i), { shouldValidate: true })}
                        className="absolute -right-2 -top-2 grid size-11 place-items-center"
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-[var(--ink)] text-white"><X aria-hidden className="size-3.5" /></span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                <label className={cn('inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 font-medium focus-within:outline focus-within:outline-2 focus-within:outline-[var(--ai)]', images.length >= MAX_IMG && 'opacity-50')}>
                  <Camera aria-hidden className="size-4" />
                  {t('report.addPhoto')}
                  <input type="file" accept={TYPES.join(',')} multiple disabled={images.length >= MAX_IMG} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                </label>
                {photoExtras?.(addFiles, images.length >= MAX_IMG)}
                </div>
                <p className="mt-1 text-sm text-[var(--ink-2)]">{t('report.photoHint')}</p>
                {images.length > 0 && photoSuggestions?.({ description: watch('description'), setDescription: (text) => setValue('description', text, { shouldValidate: true }) })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <Button type="button" intent="secondary" onClick={locate}>
                  <MapPin aria-hidden className="size-4" />
                  {t('report.useLocation')}
                </Button>
                <p className="mt-1 text-sm text-[var(--ink-2)]">{t('report.locationConsent')}</p>
                {lat !== null && <p role="status" className="mt-2 font-medium text-[var(--ok)]">{t('report.locationSet')}</p>}
              </div>
              {mapSlot?.({ lat, lng, onPick: (a, b) => { setValue('lat', a, { shouldValidate: true }); setValue('lng', b); } })}
              <div>
                <label htmlFor="lm" className="mb-1 block font-medium">{t('report.landmark')}</label>
                <input id="lm" className={field} placeholder={t('report.landmarkHint')} {...register('landmark')} aria-invalid={!!errors.landmark} aria-describedby="lm-err" />
                <p id="lm-err" role="alert" className="mt-1 text-sm text-[var(--crit)]">{msg(errors.landmark?.message)}</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <dl className="space-y-3 rounded-2xl bg-white p-4">
                <div><dt className="text-sm text-[var(--ink-2)]">{t('report.describe')}</dt><dd className="whitespace-pre-wrap">{getValues('description')}</dd></div>
                <div><dt className="text-sm text-[var(--ink-2)]">{t('report.step2')}</dt><dd>{lat !== null ? t('report.locationSet') : getValues('landmark')}</dd></div>
                <div><dt className="text-sm text-[var(--ink-2)]">{t('report.photos')}</dt><dd>{images.length}</dd></div>
              </dl>
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" className="mt-1 size-5" {...register('anonymous')} />
                <span><span className="font-medium">{t('report.anonymous')}</span><br /><span className="text-sm text-[var(--ink-2)]">{t('report.anonymousHint')}</span></span>
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        {step > 0 && <Button type="button" intent="secondary" onClick={() => setStep((s) => s - 1)}>{t('report.back')}</Button>}
        {step < 2 ? (
          <Button type="button" size="lg" className="flex-1" onClick={next}>{t('report.next')}</Button>
        ) : (
          <Button type="submit" size="lg" className="flex-1" loading={isSubmitting}>
            {isSubmitting ? t('report.sending') : t('report.send')}
          </Button>
        )}
      </div>
    </form>
  );
}
