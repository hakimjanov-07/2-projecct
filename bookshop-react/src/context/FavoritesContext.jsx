import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { useToast } from './ToastContext'

const FavoritesContext = createContext(null)
const STORAGE_KEY = 'bookshop-favorites'

const parseSaved = (raw) => {
  try {
    const saved = JSON.parse(raw || '[]')
    return Array.isArray(saved) ? saved.map(Number).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

const readSaved = () => {
  try {
    return parseSaved(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

// Sevimli kitoblar (yurakcha). Faqat kitob id'lari shu brauzerda saqlanadi.
export function FavoritesProvider({ children }) {
  const { t } = useLang()
  const { showToast } = useToast()
  const [ids, setIds] = useState(readSaved)
  const idsRef = useRef(ids)
  useEffect(() => { idsRef.current = ids }, [ids])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // Brauzer xotirasi mavjud bo'lmasa, ro'yxat faqat shu sessiya uchun saqlanadi.
    }
  }, [ids])

  // Boshqa tabda sevimlilar o'zgarsa shu tab ham yangilanadi (teng bo'lsa state almashtirilmaydi: yozish halqasi yo'q)
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return
      const next = parseSaved(event.newValue)
      if (JSON.stringify(idsRef.current) === JSON.stringify(next)) return
      idsRef.current = next
      setIds(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleFavorite = useCallback((bookId) => {
    const id = Number(bookId)
    // Ketma-ket tez bosishlarda ham eng so'nggi ro'yxat bilan ishlash uchun ref ishlatiladi
    const current = idsRef.current
    const exists = current.includes(id)
    const next = exists ? current.filter((item) => item !== id) : [id, ...current]
    idsRef.current = next
    setIds(next)
    showToast(t(exists ? 'toast.favRemoved' : 'toast.favAdded'), { icon: '♥' })
  }, [showToast, t])

  const value = useMemo(
    () => ({
      favoriteIds: ids,
      favoritesCount: ids.length,
      isFavorite: (bookId) => ids.includes(Number(bookId)),
      toggleFavorite,
    }),
    [ids, toggleFavorite]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider')
  return context
}
