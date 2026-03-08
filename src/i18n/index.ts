import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import zh from './locales/zh.json'

const STORAGE_KEY = 'bridge_language'

// Get saved language or detect from browser
function getInitialLanguage(): string {
  // Check localStorage first
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && ['en', 'zh'].includes(saved)) {
    return saved
  }

  // Detect from browser
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
})

// Save language preference when changed
i18n.on('languageChanged', lng => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
