import i18n from 'i18next';
import extra from '../locales/extra.en.json';

/** Call once after i18n.init(). Adds the auth, camera and portal namespaces without touching en.json. */
export function registerExtra() {
  for (const [ns, res] of Object.entries(extra)) i18n.addResourceBundle('en', ns, res, true, true);
}
