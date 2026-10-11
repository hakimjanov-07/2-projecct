import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import styles from './Toast.module.css'

const ToastContext = createContext(null)
const DURATION = 2800

// Tepadan chiqadigan xabar (saytning jigarrang rangida). showToast(matn, { icon, type })
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const showToast = useCallback((message, { icon = '✓', type = 'success' } = {}) => {
    clearTimeout(timerRef.current)
    setToast({ message, icon, type, id: Date.now() })
    timerRef.current = setTimeout(() => setToast(null), DURATION)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : ''}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className={styles.toastIcon} aria-hidden="true">{toast.icon}</span>
          {toast.message}
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
