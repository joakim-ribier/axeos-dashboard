// src/i18n.ts
import { initReactI18next } from "react-i18next";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

i18n
  // détecte la langue du navigateur (fallback à 'en')
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    debug: false, // mettre à true en dev si besoin
    interpolation: {
      escapeValue: false, // React s’occupe déjà de l’échappement
    },
    detection: {
      // Options du détecteur (cookies, localStorage, navigator, …)
      order: ["localStorage", "navigator", "htmlTag", "path", "subdomain"],
      caches: ["localStorage"],
    },
  });

export default i18n;
