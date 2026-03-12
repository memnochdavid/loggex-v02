import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import ca from './locales/ca.json';
import gl from './locales/gl.json';
import eu from './locales/eu.json';

const savedLang = localStorage.getItem('loggex-lang') || 'es';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      ca: { translation: ca },
      gl: { translation: gl },
      eu: { translation: eu },
    },
    lng: savedLang,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export const changeLanguage = (lang) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('loggex-lang', lang);
};

export default i18n;
