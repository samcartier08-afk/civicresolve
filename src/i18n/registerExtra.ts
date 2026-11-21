import i18n from 'i18next';
import extra from '../locales/extra.en.json';
import suggestTa from '../locales/suggest.ta.json';
import suggestHi from '../locales/suggest.hi.json';

/** Call once after i18n.init(). Adds namespaces for en, ta, and hi. */
export function registerExtra() {
  for (const [ns, res] of Object.entries(extra)) {
    i18n.addResourceBundle('en', ns, res, true, true);
  }
  i18n.addResourceBundle('ta', 'suggest', suggestTa, true, true);
  i18n.addResourceBundle('hi', 'suggest', suggestHi, true, true);
}
