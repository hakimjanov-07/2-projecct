import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './ShareButtons.module.css'

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

// Kitobni ulashish: bitta "Ulashish" tugmasi, bosilganda Telegram, Facebook, havolani nusxalash
// (va telefonda tizimning "Ulashish" oynasi) menyusi ochiladi
export default function ShareButtons({ book }) {
  const { t } = useLang()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const url = window.location.href
  const text = book.author_name ? `${book.name} — ${book.author_name}` : book.name

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('share.copied'), { icon: '🔗' })
    } catch {
      window.prompt(t('share.copy'), url) // clipboard ruxsat berilmasa, qo'lda nusxalash oynasi
    }
  }

  const nativeShare = () => navigator.share({ title: book.name, text, url }).catch(() => {})

  const items = () => Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])

  // Tashqariga bosilganda yopiladi
  useEffect(() => {
    if (!open) return undefined
    const handlePointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [open])

  const toggle = (event) => {
    if (!open) {
      // Menyu ekran o'ng chetidan chiqib ketsa, o'ngga tekislanadi
      const left = wrapRef.current.getBoundingClientRect().left
      const width = menuRef.current?.offsetWidth || 0
      setAlignRight(left + width > window.innerWidth - 8)
      // Klaviatura bilan ochilganda birinchi variantga fokus o'tadi
      if (event.detail === 0) requestAnimationFrame(() => items()[0]?.focus())
    }
    setOpen((current) => !current)
  }

  const close = () => setOpen(false)

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (!open) {
      toggle({ detail: 0 })
      return
    }
    const list = items()
    const index = list.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowDown') next = index + 1 >= list.length ? 0 : index + 1
    else if (event.key === 'ArrowUp') next = index <= 0 ? list.length - 1 : index - 1
    else if (event.key === 'Home') next = 0
    else next = list.length - 1
    list[next]?.focus()
  }

  // Tab bilan menyudan chiqilganda yopiladi
  const onBlur = (event) => {
    if (open && !wrapRef.current?.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div className={styles.row} ref={wrapRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        type="button"
        ref={triggerRef}
        className={`${styles.btn} ${open ? styles.btnOpen : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon><path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Icon>
        {t('share.title')}
      </button>

      <div
        ref={menuRef}
        role="menu"
        aria-label={t('share.title')}
        className={`${styles.menu} ${open ? styles.menuOpen : ''} ${alignRight ? styles.menuRight : ''}`}
      >
        <a
          role="menuitem"
          className={styles.item}
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          onClick={close}
        >
          <Icon><path d="M21 4 3 11l5.5 2L10 19l3-4 4.5 3.5L21 4ZM8.5 13 17 7.5" /></Icon>
          Telegram
        </a>

        <a
          role="menuitem"
          className={styles.item}
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          onClick={close}
        >
          <Icon><path d="M14 8V6.5c0-.8.4-1.5 1.5-1.5H17V2h-2.5C11.8 2 10.5 3.8 10.5 6v2H8v3h2.5v10H14V11h2.7l.3-3H14Z" /></Icon>
          Facebook
        </a>

        <button type="button" role="menuitem" className={styles.item} onClick={() => { close(); copy() }}>
          <Icon><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Icon>
          {t('share.copy')}
        </button>

        {typeof navigator.share === 'function' && (
          <button type="button" role="menuitem" className={styles.item} onClick={() => { close(); nativeShare() }}>
            <Icon><path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Icon>
            {t('share.more')}
          </button>
        )}
      </div>
    </div>
  )
}
