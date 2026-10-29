// Hermes has no Intl.PluralRules; without it i18next can't pick `_one`/`_other`
// keys and shows the raw key (e.g. "trust.review_count").
import 'intl-pluralrules'
import { getLocales } from 'expo-localization'
import * as SecureStore from 'expo-secure-store'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { setLanguage } from '../lib/api'
import mobileEn from './mobile-en'
import mobileVi from './mobile-vi'
import webEn from './web-en'
import webVi from './web-vi'

const LANG_KEY = 'tourop.lang'

const deviceLanguage = getLocales()[0]?.languageCode === 'en' ? 'en' : 'vi'

i18n.use(initReactI18next).init({
  resources: {
    // The web dictionaries are shared; the mobile ones add screen-specific strings.
    en: { translation: { ...webEn, mobile: mobileEn } },
    vi: { translation: { ...webVi, mobile: mobileVi } },
  },
  lng: deviceLanguage,
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})
setLanguage(deviceLanguage)

SecureStore.getItemAsync(LANG_KEY).then((saved) => {
  if (saved === 'vi' || saved === 'en') changeLanguage(saved)
})

export function changeLanguage(lng: 'vi' | 'en') {
  setLanguage(lng)
  i18n.changeLanguage(lng)
  SecureStore.setItemAsync(LANG_KEY, lng)
}

export default i18n
