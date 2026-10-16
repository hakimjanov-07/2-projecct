import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import styles from './Toast.module.css'

const ToastContext = createContext(null)
const DURATION = 2800
const LEAVE_MS = 280

// Tepadan chiqadigan xabar (saytning jigarrang rangida).
// showToast(matn, { icon, type, drop, duration, action: { label, onClick } })
// drop: tepadan tushuvchi, yopish tugmali variant (masalan buyurtma qabul qilinganda)
export function ToastProvider({ children }) {
  const { t } = useLang()
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const hide = useCallback(() => {
    clearTimeout(timerRef.current)
    // Tushuvchi variant avval yopilish animatsiyasini o'ynaydi, keyin olib tashlanadi
    setToast((current) => (current && current.drop ? { ...current, leaving: true } : null))
    timerRef.current = setTimeout(() => setToast(null), LEAVE_MS)
  }, [])

  const showToast = useCallback((message, { icon = '✓', type = 'success', drop = false, duration = DURATION, action = null } = {}) => {
    clearTimeout(timerRef.current)
    setToast({ message, icon, type, drop, action, id: Date.now() })
    timerRef.current = setTimeout(hide, duration)
  }, [hide])

  const value = useMemo(() => ({ showToast }), [showToast])

  const onAction = () => {
    toast?.action?.onClick?.()
    hide()
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className={[
            styles.toast,
            toast.type === 'error' ? styles.toastError : '',
            toast.drop ? styles.toastDrop : '',
            toast.leaving ? styles.toastLeaving : '',
          ].join(' ')}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className={styles.toastIcon} aria-hidden="true">{toast.icon}</span>
          <span className={styles.toastText}>{toast.message}</span>
          {toast.action && (
            <button type="button" className={styles.toastAction} onClick={onAction}>{toast.action.label}</button>
          )}
          {toast.drop && (
            <button type="button" className={styles.toastClose} onClick={hide} aria-label={t('toast.close')}>×</button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
