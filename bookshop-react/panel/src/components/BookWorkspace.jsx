import { useCallback, useEffect, useRef, useState } from 'react'
import { getBooks, updateBook } from '../api'
import { money, num } from '../format'
import { photoProblem } from '../photo'
import BookForm from './BookForm'
import BookCard from './BookCard'
import BulkEdit from './BulkEdit'
import Cover from './Cover'

const PAGE = 100
const LOW = 5 // backend LOW_STOCK bilan bir xil
const FILTERS = [
  ['', 'Hammasi'],
  ['low', 'Omborda kam'],
  ['out', 'Tugagan'],
  ['unlimited', 'Cheklanmagan'],
]
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

const stockInfo = (stock) => {
  if (stock === null || stock === undefined) return { text: 'cheklanmagan', cls: '' }
  if (stock === 0) return { text: 'Tugagan', cls: 'out' }
  return { text: `${num(stock)} ta`, cls: stock <= LOW ? 'low' : '' }
}

function BookRow({ book, active, checked, onOpen, onCheck }) {
  const st = stockInfo(book.stock)
  return (
    <div className={`ws-row ${active ? 'active' : ''} ${checked ? 'checked' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${book.name}: tanlash`}
        className={`ws-check ${checked ? 'on' : ''}`}
        onClick={(e) => onCheck(book, e)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        role="option"
        aria-selected={active || checked}
        className="ws-row-btn"
        data-id={book.id}
        onClick={(e) => onOpen(book, e)}
        onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); onCheck(book, e) } }}
      >
        <Cover book={book} />
        <span className="ws-row-main">
          <strong>{book.name}</strong>
          <small>{book.author_name}</small>
        </span>
        <span className="ws-row-side">
          <span>{book.price ? money(book.price) : "Narx yo'q"}</span>
          <small className={`ws-stock ${st.cls}`}>{st.text}</small>
        </span>
      </button>
    </div>
  )
}

const base = (book) => ({
  price: book.price == null ? '' : String(book.price),
  cost: book.cost_price == null ? '' : String(book.cost_price),
  stock: book.stock == null ? '' : String(book.stock),
  status: book.status,
})
const isInt = (v) => /^\d+$/.test(v)

// O'ng panel: tanlangan kitob tafsiloti va tahrir (key={book.id} bilan qayta yaratiladi)
function BookDetail({ book, initialExpanded, cardsBack, onSaved, onDirtyChange, onBack }) {
  const [draft, setDraft] = useState(() => base(book))
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const [expanded, setExpanded] = useState(!!initialExpanded) // false = karta rejimi, true = to'liq tahrir
  const photoInput = useRef(null)

  const orig = base(book)
  const changed = {
    price: draft.price !== orig.price,
    cost: draft.cost !== orig.cost,
    stock: draft.stock !== orig.stock,
    status: draft.status !== orig.status,
  }
  const dirty = Object.values(changed).some(Boolean)

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  const set = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setNotice('') }
  const unlimited = draft.stock === ''
  const stockNum = unlimited ? 0 : Number(draft.stock) || 0
  const price = Number(draft.price) || 0
  const cost = draft.cost === '' ? null : Number(draft.cost)
  const markup = cost === null || !price ? null : price - cost
  const pct = markup !== null && cost > 0 ? Math.round((markup / cost) * 100) : null

  const save = async () => {
    const e = {}
    if (!isInt(draft.price) || Number(draft.price) <= 0) e.price = "Narx musbat butun son bo'lishi kerak."
    if (draft.cost !== '' && !isInt(draft.cost)) e.cost = "Tannarx butun son bo'lishi kerak."
    if (draft.stock !== '' && !isInt(draft.stock)) e.stock = "Ombor soni butun son bo'lishi kerak."
    setErrors(e)
    if (Object.keys(e).length) return
    if (cost !== null && price < cost && !window.confirm("Narx tannarxdan past: kitob zarar bilan sotiladi. Baribir saqlansinmi?")) return

    const patch = {}
    if (changed.price) patch.price = Number(draft.price)
    if (changed.cost) patch.cost_price = draft.cost === '' ? null : Number(draft.cost)
    if (changed.stock) patch.stock = draft.stock === '' ? null : Number(draft.stock)
    if (changed.status) patch.status = draft.status
    setBusy(true)
    try {
      const updated = await updateBook(book.id, patch)
      const next = { ...book, ...updated }
      setDraft(base(next))
      setNotice('Saqlandi')
      onSaved(next)
    } catch (err) {
      const d = err.response?.data
      setErrors({
        price: d?.price?.[0], cost: d?.cost_price?.[0], stock: d?.stock?.[0],
        form: !d || d.detail || !(d.price || d.cost_price || d.stock) ? (d?.detail || d?.status?.[0] || "Saqlab bo'lmadi. Qayta urinib ko'ring.") : '',
      })
    } finally {
      setBusy(false)
    }
  }

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = photoProblem(file)
    if (problem) { setErrors((x) => ({ ...x, photo: problem })); return }
    setErrors((x) => ({ ...x, photo: '' }))
    try {
      const body = new FormData()
      body.append('photo', file)
      const updated = await updateBook(book.id, body)
      onSaved({ ...book, ...updated })
      setNotice('Muqova yuklandi')
    } catch (err) {
      setErrors((x) => ({ ...x, photo: err.response?.data?.photo?.[0] || "Rasmni yuklab bo'lmadi." }))
    }
  }

  const mark = (key) => (changed[key] ? 'changed' : '')

  const collapse = () => {
    if (dirty) {
      if (!window.confirm("Saqlanmagan o'zgarishlar bor. Davom etasizmi?")) return
      setDraft(base(book)); setErrors({})
    }
    setExpanded(false)
  }
  const expand = () => setExpanded(true)

  // Karta rejimi: faqat narx tahrirlanadi (savat va yurak yo'q)
  if (!expanded) {
    return (
      <div className="ws-detail-body ws-pop">
        <button type="button" className="btn btn-ghost ws-back" onClick={onBack}>← Ro'yxatga qaytish</button>
        <BookCard
          book={book}
          price={draft.price}
          onPrice={(v) => set('price', v)}
          onOpen={expand}
          error={errors.price || errors.form}
          expandedHint
        >
          <div className="ws-actions">
            <button type="button" className="btn btn-primary" disabled={!changed.price || busy} onClick={save}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
            <button type="button" className="btn btn-ghost" disabled={!changed.price || busy} onClick={() => { set('price', orig.price); setErrors({}) }}>Bekor qilish</button>
            {notice && !dirty && <span className="ws-saved" role="status">{notice}</span>}
          </div>
        </BookCard>
        <small className="field-hint">Kartani bosing: ombor, tannarx va boshqa maydonlar ochiladi.</small>
      </div>
    )
  }

  return (
    <div className="ws-detail-body ws-pop">
      <button type="button" className="btn btn-ghost ws-back" onClick={onBack}>← Ro'yxatga qaytish</button>
      <button type="button" className="btn btn-ghost ws-collapse" aria-expanded="true" onClick={cardsBack ? () => { if (dirty) { if (!window.confirm("Saqlanmagan o'zgarishlar bor. Davom etasizmi?")) return; setDraft(base(book)); setErrors({}) } cardsBack() } : collapse}>{cardsBack ? '← Kartalarga qaytish' : '← Kartaga qaytish'}</button>

      <div className="ws-hero">
        <Cover book={book} className="ws-cover-big" />
        <div className="ws-hero-info">
          <h3>{book.name}</h3>
          <p className="muted">{book.author_name}</p>
          <p className="ws-meta">
            {book.category_name}
            {book.language && ` · ${{ uzbek: "O'zbekcha", russian: 'Ruscha', english: 'Inglizcha', turkish: 'Turkcha', german: 'Nemischa', others: 'Boshqa til' }[book.language] || book.language}`}
            {book.pages ? ` · ${num(book.pages)} bet` : ''}
          </p>
          <p className="ws-meta">Sotilgan: <b>{num(book.sold)}</b> ta · Tushum: <b>{money(book.revenue)}</b></p>
          <input ref={photoInput} type="file" hidden accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
          <button type="button" className="btn btn-ghost ws-photo-btn" onClick={() => photoInput.current?.click()}>
            {book.photo_url ? 'Rasmni almashtirish' : 'Rasm yuklash'}
          </button>
          {errors.photo && <small className="field-error">{errors.photo}</small>}
        </div>
      </div>

      {book.about && (
        <div className="ws-about">
          <p className={more ? '' : 'clamp'}>{book.about}</p>
          {book.about.length > 220 && <button type="button" className="link-btn" onClick={() => setMore((m) => !m)}>{more ? 'Kamroq' : "Ko'proq"}</button>}
        </div>
      )}

      <div className="ws-edit card">
        <div className={`field ws-field ${mark('stock')} ${errors.stock ? 'has-error' : ''}`}>
          <span>Ombor soni {changed.stock && <em className="ws-dot">o'zgargan</em>}</span>
          <div className="ws-stepper">
            <button type="button" className="btn btn-ghost" disabled={unlimited || stockNum <= 0} aria-label="Bittaga kamaytirish" onClick={() => set('stock', String(Math.max(0, stockNum - 1)))}>−</button>
            <input type="number" min="0" step="1" inputMode="numeric" placeholder="cheklanmagan" value={draft.stock} onChange={(e) => set('stock', e.target.value)} />
            <button type="button" className="btn btn-ghost" disabled={unlimited} aria-label="Bittaga oshirish" onClick={() => set('stock', String(stockNum + 1))}>+</button>
          </div>
          <div className="ws-quick">
            {[10, 50].map((n) => (
              <button key={n} type="button" className="btn btn-ghost" disabled={unlimited} title="Mavjud qoldiqqa qo'shish (ombor to'ldirish)" onClick={() => set('stock', String(stockNum + n))}>+{n}</button>
            ))}
            <label className="check ws-unl">
              <input type="checkbox" checked={unlimited} onChange={(e) => set('stock', e.target.checked ? '' : '0')} />
              Cheklanmagan
            </label>
          </div>
          {errors.stock ? <small className="field-error">{errors.stock}</small> : <small className="field-hint">Bo'sh = qoldiq hisoblanmaydi. Hozir: {stockInfo(book.stock).text}</small>}
        </div>

        <div className="form-row">
          <label className={`field ws-field ${mark('price')} ${errors.price ? 'has-error' : ''}`}>
            <span>Narx (so'm) {changed.price && <em className="ws-dot">o'zgargan</em>}</span>
            <input type="number" min="1" step="1" inputMode="numeric" value={draft.price} onChange={(e) => set('price', e.target.value)} />
            {errors.price && <small className="field-error">{errors.price}</small>}
          </label>
          <label className={`field ws-field ${mark('cost')} ${errors.cost ? 'has-error' : ''}`}>
            <span>Tannarx (so'm) {changed.cost && <em className="ws-dot">o'zgargan</em>}</span>
            <input type="number" min="0" step="1" inputMode="numeric" placeholder="noma'lum" value={draft.cost} onChange={(e) => set('cost', e.target.value)} />
            {errors.cost && <small className="field-error">{errors.cost}</small>}
          </label>
        </div>

        <p className="ws-markup">
          Ustama:{' '}
          {markup === null ? <b>—</b> : <b className={markup < 0 ? 'neg' : ''}>{money(markup)}{pct !== null && ` (${pct}%)`}</b>}
        </p>
        {markup !== null && markup < 0 && <p className="field-warn">Diqqat: narx tannarxdan past — zarar bilan sotiladi.</p>}

        <div className={`ws-status ${mark('status')}`}>
          <span>Holat {changed.status && <em className="ws-dot">o'zgargan</em>}</span>
          <button
            type="button"
            className={`switch ${draft.status === 'active' ? 'on' : ''}`}
            aria-pressed={draft.status === 'active'}
            title={draft.status === 'active' ? 'Faol' : 'Faol emas'}
            onClick={() => set('status', draft.status === 'active' ? 'deactive' : 'active')}
          ><span /></button>
          <small className="field-hint">{draft.status === 'active' ? 'Faol (saytda ko\'rinadi)' : 'Faol emas'}</small>
        </div>

        {errors.form && <p className="alert">{errors.form}</p>}
        <div className="ws-actions">
          <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
          <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={() => { setDraft(base(book)); setErrors({}) }}>Bekor qilish</button>
          {notice && !dirty && <span className="ws-saved" role="status">{notice}</span>}
        </div>
      </div>
    </div>
  )
}

// To'liq ekranli ish oynasi: chapda kitoblar ro'yxati, o'ngda tanlangan kitob
export default function BookWorkspace({ onClose }) {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [list, setList] = useState({ key: null, items: [], count: 0, page: 0, error: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const [selected, setSelected] = useState(null) // kitob obyekti | 'new' | null
  const [closing, setClosing] = useState(false)
  const [checked, setChecked] = useState({}) // id -> kitob (tanlanganlar; filtr o'zgarsa ham saqlanadi)
  const [bulkView, setBulkView] = useState(false) // mobilda ommaviy panel ko'rinadimi
  const anchor = useRef(null)
  const [focusId, setFocusId] = useState(null) // ommaviy kartalardan biri to'liq tahrir uchun ochilgan
  const root = useRef(null)
  const sentinel = useRef(null)
  const dirtyRef = useRef(false)
  const changedRef = useRef(false) // ro'yxat sahifasini yangilash kerakmi
  const reqId = useRef(0)
  const opener = useRef(document.activeElement)
  const key = `${q}|${filter}`

  // Ikki manba: ommaviy kartalar (narx qoralamalari) va to'liq tahrir
  const bulkDirty = useRef(false)
  const detailDirty = useRef(false)
  const setBulkDirty = useCallback((v) => { bulkDirty.current = v; dirtyRef.current = v || detailDirty.current }, [])
  const setDetailDirty = useCallback((v) => { detailDirty.current = v; dirtyRef.current = v || bulkDirty.current }, [])

  // Qidiruv: 300 ms kechiktirish
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchPage = useCallback((page) => (
    getBooks({ page, page_size: PAGE, q: q || undefined, stock: filter || undefined, ordering: 'name' })
  ), [q, filter])

  // So'rov o'zgarsa, birinchi sahifa qayta yuklanadi (eski ma'lumot yuklanguncha ko'rinib turadi)
  useEffect(() => {
    const id = ++reqId.current
    fetchPage(1)
      .then((data) => id === reqId.current && setList({ key, items: data.results, count: data.count, page: 1, error: false }))
      .catch(() => id === reqId.current && setList((l) => ({ ...l, key, error: true })))
  }, [fetchPage, key])

  const hasMore = list.items.length < list.count
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || list.key !== key) return
    const id = reqId.current
    setLoadingMore(true)
    fetchPage(list.page + 1)
      .then((data) => id === reqId.current && setList((l) => ({
        ...l, page: l.page + 1, count: data.count,
        items: [...l.items, ...data.results.filter((r) => !l.items.some((i) => i.id === r.id))],
      })))
      .catch(() => id === reqId.current && setList((l) => ({ ...l, error: true })))
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore, list.key, list.page, key, fetchPage])

  // Cheksiz skroll: ro'yxat oxiriga yetganda keyingi sahifa
  useEffect(() => {
    const el = sentinel.current
    if (!el) return undefined
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore() }, { root: el.parentElement, rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore, list.items.length])

  const confirmLeave = () => !dirtyRef.current || window.confirm('Saqlanmagan o\'zgarishlar bor. Davom etasizmi?')

  const requestClose = () => {
    if (!confirmLeave()) return
    setClosing(true)
    onClose(changedRef.current)
  }
  const closeRef = useRef(requestClose)
  useEffect(() => { closeRef.current = requestClose })

  // Scroll-lock, Esc va fokus tuzog'i
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return }
      if (e.key !== 'Tab' || !root.current) return
      const side = document.querySelector('.sidebar')
      const zone = [side, root.current].filter(Boolean)
      const items = zone.flatMap((z) => [...z.querySelectorAll(FOCUSABLE)]).filter((n) => n.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!zone.some((z) => z.contains(document.activeElement))) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    const onNav = (e) => {
      if (!e.target.closest?.('.sidebar a')) return
      if (dirtyRef.current && !window.confirm("Saqlanmagan o'zgarishlar bor. Davom etasizmi?")) { e.preventDefault(); e.stopPropagation() }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onNav, true)
    const target = opener.current
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onNav, true)
      if (target && target.focus) target.focus()
    }
  }, [])

  const checkedCount = Object.keys(checked).length

  // Ommaviy rejimdagi kartani to'liq tahrir uchun ochish (tanlov va narx qoralamalari saqlanadi)
  const openFromBulk = (book) => setFocusId(book.id)

  // Kartadagi "×": tanlovdan chiqarish (o'zgargan narx bo'lsa so'raladi)
  const uncheckOne = (book, hasChange) => {
    if (hasChange && !window.confirm("Bu kitobning o'zgartirilgan narxi saqlanmaydi. Tanlovdan chiqarilsinmi?")) return
    setChecked((prev) => { const next = { ...prev }; delete next[book.id]; return next })
  }

  // Tanlash (galochka): Shift = oraliq, Ctrl/Cmd = qo'shish/olib tashlash
  const toggleCheck = (book, e) => {
    if (checkedCount === 0) {
      if (!confirmLeave()) return
      dirtyRef.current = false
    }
    if (checkedCount > 0 && checked[book.id] && !e?.shiftKey && !confirmLeave()) return
    const items = list.items
    setChecked((prev) => {
      const next = { ...prev }
      if (e?.shiftKey && anchor.current != null) {
        const a = items.findIndex((i) => i.id === anchor.current)
        const b = items.findIndex((i) => i.id === book.id)
        if (a !== -1 && b !== -1) {
          items.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((i) => { next[i.id] = i })
          return next
        }
      }
      if (next[book.id]) delete next[book.id]
      else next[book.id] = book
      return next
    })
    anchor.current = book.id
  }

  // Qatorning istalgan joyiga bosish = tanlash/bekor qilish (Shift = oraliq); to'liq tahrir o'rtadagi kartani bosganda ochiladi
  const onRowOpen = toggleCheck

  const visibleAll = list.items.length > 0 && list.items.every((i) => checked[i.id])
  const visibleSome = list.items.some((i) => checked[i.id])
  const toggleAll = () => {
    if (checkedCount === 0) {
      if (!confirmLeave()) return
      dirtyRef.current = false
    }
    if (visibleAll && checkedCount > 0 && !confirmLeave()) return
    setChecked((prev) => {
      const next = { ...prev }
      if (visibleAll) list.items.forEach((i) => { delete next[i.id] })
      else list.items.forEach((i) => { next[i.id] = i })
      return next
    })
  }
  const clearChecked = () => {
    if (!confirmLeave()) return
    dirtyRef.current = false
    setChecked({})
    setFocusId(null)
    setBulkView(false)
  }

  // Ommaviy tahrir muvaffaqiyatli: ro'yxat qatorlari va tanlov darrov yangilanadi
  const onBulkApplied = (rows) => {
    changedRef.current = true
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    const merge = (b) => (byId[b.id] ? { ...b, ...byId[b.id] } : b)
    setList((l) => ({ ...l, items: l.items.map(merge) }))
    setChecked((prev) => Object.fromEntries(Object.entries(prev).map(([id, b]) => [id, merge(b)])))
    setSelected((s) => (s && s !== 'new' ? merge(s) : s))
  }

  const startNew = () => {
    if (!confirmLeave()) return
    dirtyRef.current = false
    setSelected('new')
  }

  const onSaved = (next) => {
    changedRef.current = true
    setSelected(next)
    setChecked((prev) => (prev[next.id] ? { ...prev, [next.id]: next } : prev))
    setList((l) => ({ ...l, items: l.items.map((i) => (i.id === next.id ? next : i)) }))
  }

  // Yangi kitob yaratildi: ro'yxatga tushirib, avtomatik tanlaymiz
  const onCreated = async (created) => {
    changedRef.current = true
    try {
      const res = await getBooks({ page: 1, page_size: 5, q: created.name, ordering: '-created_on' })
      const book = res.results.find((b) => b.id === created.id)
      if (book) {
        setList((l) => ({ ...l, count: l.count + 1, items: [book, ...l.items.filter((i) => i.id !== book.id)] }))
        setSelected(book)
        return
      }
    } catch { /* quyida oddiy yangilanadi */ }
    setSelected(null)
    setSearch('')
    setFilter('')
  }

  // Klaviatura: ↑/↓ qatorlar orasida yuradi (Enter/Space tanlaydi)
  const onListKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = [...e.currentTarget.querySelectorAll('.ws-row-btn')]
    const idx = rows.indexOf(document.activeElement)
    if (idx === -1 && !rows.length) return
    e.preventDefault()
    const next = e.key === 'ArrowDown' ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1)
    rows[next]?.focus()
  }

  const checkedBooks = Object.values(checked)
  const focusBook = focusId != null ? checked[focusId] : null
  const detailOpen = checkedCount > 0 ? bulkView : selected !== null
  const loading = list.key !== key

  return (
    <div className={`ws-overlay ${closing ? 'closing' : ''}`} ref={root} role="dialog" aria-modal="false" aria-label="Kitoblar bilan ishlash">
      <header className="ws-head">
        <h2>Kitoblar bilan ishlash</h2>
        <button type="button" className="btn btn-ghost ws-close" onClick={requestClose} aria-label="Yopish">×</button>
      </header>

      <div className={`ws-body ${detailOpen ? 'show-detail' : ''}`}>
        <section className="ws-detail" aria-label="Tanlangan kitob">
          {checkedCount > 0 && (
            <div hidden={!!focusBook}>
              <BulkEdit books={checkedBooks} onApplied={onBulkApplied} onClear={clearChecked} onRemove={uncheckOne} onOpenBook={openFromBulk} onDirtyChange={setBulkDirty} onBack={() => setBulkView(false)} />
            </div>
          )}
          {checkedCount > 0 && focusBook && (
            <div className="ws-fade" key={focusBook.id}>
              <BookDetail book={focusBook} initialExpanded cardsBack={() => setFocusId(null)} onSaved={onSaved} onDirtyChange={setDetailDirty} onBack={() => setBulkView(false)} />
            </div>
          )}
          {checkedCount === 0 && selected === null && (
            <div className="ws-placeholder">
              <p>O'ngdagi ro'yxatdan kitobni tanlang yoki yangi kitob qo'shing.</p>
            </div>
          )}
          {checkedCount === 0 && selected === 'new' && (
            <div className="ws-detail-body ws-fade">
              <button type="button" className="btn btn-ghost ws-back" onClick={() => setSelected(null)}>← Ro'yxatga qaytish</button>
              <h3>Yangi kitob</h3>
              <BookForm embedded onClose={() => setSelected(null)} onCreated={onCreated} />
            </div>
          )}
          {checkedCount === 0 && selected && selected !== 'new' && (
            <div className="ws-fade" key={selected.id}>
              <BookDetail
                book={selected}
                onSaved={onSaved}
                onDirtyChange={setDetailDirty}
                onBack={() => { if (confirmLeave()) { dirtyRef.current = false; setSelected(null) } }}
              />
            </div>
          )}
        </section>

        <section className="ws-list" aria-label="Kitoblar ro'yxati">
          <div className="ws-tools">
            <div className="ws-search-row">
              <input autoFocus type="search" placeholder="Nom yoki muallif bo'yicha qidirish" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Qidirish" />
              <button type="button" className="btn btn-primary" onClick={startNew}>+ Yangi kitob</button>
            </div>
            <div className="seg ws-filters" role="group" aria-label="Ombor filtri">
              {FILTERS.map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'on' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            <div className="ws-selbar">
              <button
                type="button" role="checkbox" aria-checked={visibleAll ? true : visibleSome ? 'mixed' : false}
                className={`ws-check ${visibleAll ? 'on' : visibleSome ? 'mixed' : ''}`} aria-label="Ko'rinib turgan hammasini tanlash" onClick={toggleAll}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d={visibleSome && !visibleAll ? 'M4 8h8' : 'M3.5 8.5l3 3 6-7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <small className="muted">
                {list.key === null ? 'Yuklanmoqda…' : `${num(list.count)} ta kitob`}
                {checkedCount > 0 && <b className="ws-sel-count" aria-live="polite"> · {num(checkedCount)} ta tanlandi</b>}
              </small>
              {checkedCount > 0 && <button type="button" className="link-btn" onClick={clearChecked}>Tanlovni bekor qilish</button>}
            </div>
          </div>
          <div className={`ws-rows ${loading ? 'is-loading' : ''}`} role="listbox" aria-label="Kitoblar" onKeyDown={onListKey}>
            {list.error && <p className="alert">Ro'yxatni yuklab bo'lmadi. Qayta urinib ko'ring.</p>}
            {list.key !== null && !loading && list.items.length === 0 && <p className="muted ws-empty">Kitob topilmadi.</p>}
            {list.items.map((b) => (
              <BookRow key={b.id} book={b} active={checkedCount === 0 && selected !== 'new' && selected?.id === b.id} checked={!!checked[b.id]} onOpen={onRowOpen} onCheck={toggleCheck} />
            ))}
            <div ref={sentinel} className="ws-sentinel">
              {loadingMore && <small className="muted">Yuklanmoqda…</small>}
              {hasMore && !loadingMore && <button type="button" className="link-btn" onClick={loadMore}>Yana yuklash</button>}
            </div>
          </div>
          {checkedCount > 0 && (
            <button type="button" className="btn btn-primary ws-bulk-fab" onClick={() => setBulkView(true)}>Ommaviy tahrir ({checkedCount})</button>
          )}
        </section>
      </div>
    </div>
  )
}
