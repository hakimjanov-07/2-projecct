import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './FormSelect.module.css'

const MAX_HEIGHT = 280
const GAP = 6
const EDGE = 8

// Forma uchun ochiladigan tanlov (SortSelect/FilterSelect uslubida).
// Ro'yxat portal orqali body'ga chiqariladi: oyna ichki skrolli uni kesib qo'ymasin.
// Fokus tugmada qoladi (aria-activedescendant), shuning uchun oyna fokus tuzog'i buzilmaydi.
export default function FormSelect({ id, label, value, options, onChange, placeholder, error, disabled = false, autoComplete }) {
  const autoId = useId()
  const baseId = id || autoId
  const listId = `${baseId}-list`
  const errorId = `${baseId}-error`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const openList = () => {
    if (disabled) return
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }
  const closeList = useCallback(() => setOpen(false), [])

  // Panel joyi: odatda pastda, joy yetmasa va tepada ko'p bo'lsa yuqoriga ochiladi
  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - GAP - EDGE
    const above = rect.top - GAP - EDGE
    const wanted = Math.min(MAX_HEIGHT, (panelRef.current?.scrollHeight || MAX_HEIGHT) + 2)
    const up = below < Math.min(wanted, 160) && above > below
    const room = up ? above : below
    setPos({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(MAX_HEIGHT, room)),
      ...(up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      up,
    })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const handlePointer = (event) => {
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return
      closeList()
    }
    document.addEventListener('mousedown', handlePointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place, closeList])

  // Faol element ko'rinib tursin
  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(`${baseId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, baseId, pos])

  const choose = (index) => {
    const option = options[index]
    if (option) onChange(option.value)
    closeList()
    triggerRef.current?.focus({ preventScroll: true })
  }

  const handleKeyDown = (event) => {
    const last = options.length - 1
    switch (event.key) {
      case 'Escape':
        // Faqat ro'yxatni yopadi, oynani emas
        if (open) {
          event.preventDefault()
          event.stopPropagation()
          closeList()
        }
        break
      case 'Tab':
        if (open) closeList()
        break
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        if (!open) {
          openList()
          break
        }
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((current) => Math.min(last, Math.max(0, current + step)))
        break
      }
      case 'Home':
        if (open) {
          event.preventDefault()
          setActive(0)
        }
        break
      case 'End':
        if (open) {
          event.preventDefault()
          setActive(last)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) choose(active)
        else openList()
        break
      default:
    }
  }

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      {label && <label className={styles.label} htmlFor={baseId}>{label}</label>}
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${baseId}-opt-${active}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete={autoComplete}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? styles.selected : styles.placeholder}>{selected ? selected.label : placeholder}</span>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {error && <span id={errorId} className={styles.err}>{error}</span>}

      {open && createPortal(
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className={`${styles.menu} ${pos?.up ? styles.menuUp : ''}`}
          style={pos ? { left: pos.left, width: pos.width, maxHeight: pos.maxHeight, top: pos.top, bottom: pos.bottom } : { visibility: 'hidden' }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <div
                key={option.value}
                id={`${baseId}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${index === active ? styles.optionActive : ''}`}
                onMouseMove={() => active !== index && setActive(index)}
                onClick={() => choose(index)}
              >
                <span className={styles.optionText}>{option.label}</span>
                {isSelected && (
                  <svg className={styles.check} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
