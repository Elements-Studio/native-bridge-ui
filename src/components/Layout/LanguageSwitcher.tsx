import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map((lang, index) => (
        <span key={lang.code} className="flex items-center">
          <button
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`px-2 py-1 text-sm transition-colors ${
              i18n.language === lang.code
                ? 'text-accent-foreground font-semibold'
                : 'text-secondary-foreground hover:text-accent-foreground'
            }`}
          >
            {lang.label}
          </button>
          {index < LANGUAGES.length - 1 && <span className="text-secondary-foreground/50">|</span>}
        </span>
      ))}
    </div>
  )
}
