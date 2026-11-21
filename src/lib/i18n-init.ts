"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import { registerExtra } from "../i18n/registerExtra";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  registerExtra();
}

export default i18n;
