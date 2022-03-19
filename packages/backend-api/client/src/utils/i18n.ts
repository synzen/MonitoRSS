/* eslint-disable import/extensions */
import defaulti18n, { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en-us/translation.json';

// @ts-ignore
const i18n = defaulti18n.default ? defaulti18n.default : defaulti18n;

const resources: Resource = {
  en: {
    translation: en,
  },
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    fallbackLng: 'en',
    lng: 'en',
    resources,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
