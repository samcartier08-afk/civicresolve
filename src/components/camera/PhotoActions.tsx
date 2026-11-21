"use client";
import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';

const MAX_SIDE = 1600;
interface Props { onFiles: (files: File[]) => void; disabled?: boolean }

/** "Take a photo" button. Gallery upload stays with the form's own "Add a photo" control. */
export function PhotoActions({ onFiles, disabled }: Props) {
  const { t } = useTranslation('camera');
  const [open, setOpen] = useState(false);
  const fallback = useRef<HTMLInputElement>(null);

  const take = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera: Cam, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const p = await Cam.getPhoto({ quality: 85, width: MAX_SIDE, resultType: CameraResultType.Uri, source: CameraSource.Camera });
        const blob = await (await fetch(p.webPath!)).blob();
        onFiles([new File([blob], `photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })]);
      } catch (e) {
        if (!String(e).toLowerCase().includes('cancel')) toast.error(t('error'));
      }
    } else if (typeof navigator.mediaDevices?.getUserMedia === 'function') setOpen(true);
    else fallback.current?.click(); // plain-http or older browsers: hand off to the phone's camera app
  };

  return (
    <>
      <Button type="button" intent="secondary" onClick={take} disabled={disabled}>
        <Camera aria-hidden className="size-4" />
        {t('take')}
      </Button>
      <input ref={fallback} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { if (e.target.files) onFiles(Array.from(e.target.files)); e.target.value = ''; }} />
      {open && <CameraDialog onClose={() => setOpen(false)} onCapture={(f) => onFiles([f])} />}
    </>
  );
}

function CameraDialog({ onClose, onCapture }: { onClose: () => void; onCapture: (f: File) => void }) {
  const { t } = useTranslation('camera');
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [problem, setProblem] = useState<'denied' | 'unavailable' | null>(null);
  const [taken, setTaken] = useState(0);

  useEffect(() => { const d = dialog.current; d?.showModal(); return () => d?.close(); }, []);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((x) => x.stop()); return; }
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((e: unknown) => setProblem((e as DOMException).name === 'NotAllowedError' ? 'denied' : 'unavailable'));
    return () => { cancelled = true; stream?.getTracks().forEach((x) => x.stop()); }; // always release the camera
  }, [facing]);

  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const k = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k);
    c.height = Math.round(v.videoHeight * k);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      if (!b) return;
      onCapture(new File([b], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })); // canvas output carries no EXIF/GPS
      setTaken((n) => n + 1);
    }, 'image/jpeg', 0.85);
  };

  return (
    <dialog ref={dialog} onClose={onClose} aria-label={t('title')} className="m-auto w-[min(96vw,560px)] overflow-hidden rounded-2xl p-0 backdrop:bg-black/60">
      {problem ? (
        <div role="alert" className="space-y-4 p-6">
          <p>{t(problem)}</p>
          <Button type="button" onClick={onClose}>{t('close')}</Button>
        </div>
      ) : (
        <div className="bg-black">
          <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="flex items-center justify-between gap-3 bg-white p-4">
            <Button type="button" intent="secondary" size="icon" aria-label={t('flip')} onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
              <RefreshCw aria-hidden className="size-5" />
            </Button>
            <button type="button" aria-label={t('shutter')} onClick={snap} className="size-16 rounded-full border-4 border-[var(--ink)] bg-white active:scale-95 motion-reduce:active:scale-100">
              <span className="mx-auto block size-10 rounded-full bg-[var(--ink)]" />
            </button>
            <Button type="button" onClick={onClose}>{t('done')}</Button>
          </div>
          <p aria-live="polite" className="bg-white px-4 pb-3 text-center text-sm text-[var(--ink-2)]">{taken > 0 && t('captured', { count: taken })}</p>
        </div>
      )}
    </dialog>
  );
}
