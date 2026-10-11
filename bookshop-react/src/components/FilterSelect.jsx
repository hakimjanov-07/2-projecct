import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import styles from './FilterSelect.module.css'

// Ochiladigan, qidiruvli tanlov: uzun ro'yxat o'rniga ixcham maydon
export default function FilterSelect({ label, placeholder, allLabel, options, value, onChange }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selected = options.find((option) => option.value === value)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options
  }, [options, query])

  const choose = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={styles.field} ref={rootRef}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? styles.selected : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          <button type="button" className={`${styles.option} ${!selected ? styles.optionActive : ''}`} onClick={() => choose(null)}>
            {allLabel}
          </button>
          {options.length > 6 && (
            <input
              className={styles.search}
              type="search"
              placeholder={t('books.searchInList')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          )}
          <div className={styles.options}>
            {visible.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`${styles.option} ${option.value === value ? styles.optionActive : ''}`}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
              </button>
            ))}
            {visible.length === 0 && <p className={styles.empty}>{t('books.nothingFound')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
