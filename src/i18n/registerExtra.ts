import i18n from 'i18next';
import extraEn from '../locales/extra.en.json';
import extraTa from '../locales/extra.ta.json';
import extraHi from '../locales/extra.hi.json';
import suggestTa from '../locales/suggest.ta.json';
import suggestHi from '../locales/suggest.hi.json';

/** Call once after i18n.init(). Adds namespaces for en, ta, and hi. */
export function registerExtra() {
  for (const [ns, res] of Object.entries(extraEn)) {
    i18n.addResourceBundle('en', ns, res, true, true);
  }
  for (const [ns, res] of Object.entries(extraTa)) {
    i18n.addResourceBundle('ta', ns, res, true, true);
  }
  for (const [ns, res] of Object.entries(extraHi)) {
    i18n.addResourceBundle('hi', ns, res, true, true);
  }
  i18n.addResourceBundle('ta', 'suggest', suggestTa, true, true);
  i18n.addResourceBundle('hi', 'suggest', suggestHi, true, true);
}
