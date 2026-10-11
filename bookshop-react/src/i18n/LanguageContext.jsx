import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import dict, { LANGUAGES, LOCALES } from './translations'

const STORAGE_KEY = 'bookshop-lang'
const LanguageContext = createContext(null)

const readSavedLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.some((language) => language.code === saved) ? saved : 'uz'
  } catch {
    return 'uz'
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readSavedLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((code) => {
    setLangState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Brauzer xotirasi mavjud bo'lmasa, til faqat shu sessiya uchun almashadi.
    }
  }, [])

  const value = useMemo(() => {
    const t = (key, vars = {}) => {
      const entry = dict[key]
      const text = entry?.[lang] ?? entry?.uz ?? key
      return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match))
    }
    return { lang, setLang, t, locale: LOCALES[lang] }
  }, [lang, setLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLang must be used inside LanguageProvider')
  return context
}
