import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

// Clinical parameter values themselves (SpO2, AVPU/ACVPU states, numeric
// vitals) are deliberately NOT translated anywhere in this app — clinicians
// are trained on standard English clinical terminology, and inventing
// translated versions of standardized medical abbreviations risks confusion
// or error. Only UI chrome (navigation, labels, buttons, guidance copy) is
// translated. See README "Design decisions" section.

const STORAGE_KEY = 'pulseward_language';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
  },
  lng: localStorage.getItem(STORAGE_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
