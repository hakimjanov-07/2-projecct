import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n/LanguageContext'
import styles from './Modal.module.css'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Umumiy oyna: Esc va fon bosilganda yopiladi, fokus oyna ichida qoladi, orqa sahifa aylanmaydi
export default function Modal({ title, onClose: onCloseProp, children, wide = false }) {
  const { t } = useLang()
  const titleId = useId()
  const dialogRef = useRef(null)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  // Yopilganda 160ms fade-out, so'ng haqiqiy onClose (reduced-motion da darhol)
  const onClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (instant) {
      onCloseProp()
      return
    }
    setClosing(true)
    setTimeout(onCloseProp, 160)
  }, [onCloseProp])
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement
    const { overflow, paddingRight } = document.body.style
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    const dialog = dialogRef.current
    const first = dialog.querySelector('[data-autofocus]') || dialog.querySelector(FOCUSABLE)
    ;(first || dialog).focus({ preventScroll: true })

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null)
      if (nodes.length === 0) {
        event.preventDefault()
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  return createPortal(
    <div
      className={`${styles.backdrop} ${closing ? styles.out : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${wide ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.head}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('modal.close')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
