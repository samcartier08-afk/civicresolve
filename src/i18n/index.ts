import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import ta from '../locales/ta.json';
import hi from '../locales/hi.json';
import { registerExtra } from './registerExtra';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

function initialLang() {
  if (typeof window === 'undefined') return 'en';
  let saved: string | null = null;
  try { saved = localStorage.getItem('lang'); } catch { /* storage blocked */ }
  const code = saved ?? navigator.language.split('-')[0];
  return LANGS.some((l) => l.code === code) ? code : 'en';
}

export function initI18nSync() {
  if (i18n.isInitialized) return i18n;
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
      hi: { translation: hi },
    },
    lng: initialLang(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  registerExtra();
  return i18n;
}

export async function initI18n() {
  initI18nSync();
}

export default i18n;
