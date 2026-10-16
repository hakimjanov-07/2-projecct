import { useEffect, useState } from 'react'
import { bulkUpdateBooks } from '../api'
import { money, num } from '../format'
import BookCard from './BookCard'

const MAX = 200
const EXTRA = { cost: '', stockMode: '', stock: '', status: '' }
const isInt = (v) => /^\d+$/.test(v)
const isSigned = (v) => /^-?\d+$/.test(v)
const orig = (b) => (b.price == null ? '' : String(b.price))

// Tanlangan kitoblar: har biri alohida karta (narx kiritiladi); qo'shimcha ommaviy maydonlar yig'ilgan bo'limda
export default function BulkEdit({ books, onApplied, onClear, onRemove, onOpenBook, onDirtyChange, onBack }) {
  const [prices, setPrices] = useState({}) // id -> narx qoralamasi (yo'q = joriy narx)
  const [same, setSame] = useState('')
  const [percent, setPercent] = useState('')
  const [extra, setExtra] = useState(EXTRA)
  const [showExtra, setShowExtra] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const priceOf = (b) => (b.id in prices ? prices[b.id] : orig(b))
  const changedBooks = books.filter((b) => priceOf(b) !== orig(b))
  const extraOn = extra.cost !== '' || extra.stockMode !== '' || extra.status !== ''
  const dirty = changedBooks.length > 0 || extraOn
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  const setExtraField = (key, value) => { setExtra((x) => ({ ...x, [key]: value })); setResult(null) }
  const setPrice = (id, value) => { setPrices((p) => ({ ...p, [id]: value })); setResult(null) }

  // Hammasiga bir xil narx yoki foiz: faqat inputlarni to'ldiradi, saqlamaydi
  const fillSame = () => {
    if (!isInt(same) || Number(same) < 1) return
    setPrices(Object.fromEntries(books.map((b) => [b.id, same])))
    setResult(null)
  }
  const fillPercent = () => {
    if (!isSigned(percent) || Number(percent) < -90 || Number(percent) > 300) return
    setPrices((p) => ({
      ...p,
      ...Object.fromEntries(books.filter((b) => b.price).map((b) => [b.id, String(Math.max(1, Math.round((b.price * (100 + Number(percent))) / 100)))])),
    }))
    setResult(null)
  }
  const sameOk = isInt(same) && Number(same) >= 1
  const percentOk = isSigned(percent) && Number(percent) >= -90 && Number(percent) <= 300

  const problems = []
  const badPrice = changedBooks.filter((b) => !isInt(priceOf(b)) || Number(priceOf(b)) < 1)
  if (badPrice.length) problems.push(`${badPrice.length} ta kartada narx musbat butun son bo'lishi kerak.`)
  if (extra.cost !== '' && (!isInt(extra.cost) || Number(extra.cost) < 1)) problems.push("Tannarx musbat butun son bo'lishi kerak.")
  if ((extra.stockMode === 'set' || extra.stockMode === 'add') && !isInt(extra.stock)) problems.push("Ombor soni butun son bo'lishi kerak.")
  if (extra.stockMode === 'add' && isInt(extra.stock)) {
    const unl = books.filter((b) => b.stock === null).length
    if (unl) problems.push(`${unl} ta kitobning ombori cheklanmagan: ularga qo'shib bo'lmaydi. Tanlovdan olib tashlang yoki "Aniq qiymat" ni tanlang.`)
  }
  if (books.length > MAX) problems.push(`Bir martada ${MAX} tagacha kitob tahrirlanadi (hozir ${books.length}).`)

  const newPrice = (b) => (isInt(priceOf(b)) && Number(priceOf(b)) > 0 ? Number(priceOf(b)) : b.price)
  const newCost = (b) => (extra.cost !== '' && isInt(extra.cost) ? Number(extra.cost) : b.cost_price)
  const loss = books.filter((b) => {
    const p = newPrice(b)
    const c = newCost(b)
    return p != null && c != null && p < c
  })

  const affected = extraOn ? books.length : changedBooks.length

  const describe = () => {
    const parts = []
    if (changedBooks.length) parts.push(`${changedBooks.length} ta kitobda narx o'zgaradi`)
    if (extra.cost !== '') parts.push(`tannarx → ${money(extra.cost)}`)
    if (extra.stockMode) parts.push(`ombor → ${{ set: extra.stock, add: `+${extra.stock}`, unlimited: 'cheklanmagan' }[extra.stockMode]}`)
    if (extra.status) parts.push(`holat → ${extra.status === 'active' ? 'faol' : 'faol emas'}`)
    return parts.join(', ')
  }

  const apply = async () => {
    setError('')
    if (!dirty || problems.length) return
    const warn = loss.length ? `\n\nDiqqat: ${loss.length} ta kitob zarar bilan sotiladi (narx < tannarx).` : ''
    if (!window.confirm(`${affected} ta kitob o'zgartiriladi: ${describe()}. Davom etasizmi?${warn}`)) return
    const body = { items: changedBooks.map((b) => ({ id: b.id, price: Number(priceOf(b)) })) }
    if (extraOn) {
      body.ids = books.map((b) => b.id)
      if (extra.cost !== '') body.cost_price = Number(extra.cost)
      if (extra.stockMode) {
        body.stock_mode = extra.stockMode
        if (extra.stockMode !== 'unlimited') body.stock = Number(extra.stock)
      }
      if (extra.status) body.status = extra.status
    }
    if (!body.items.length) delete body.items
    setBusy(true)
    try {
      const res = await bulkUpdateBooks(body)
      onApplied(res.books)
      setResult(res)
      setPrices({})
      setExtra(EXTRA)
      setSame('')
      setPercent('')
    } catch (err) {
      const d = err.response?.data
      const first = d && typeof d === 'object' ? Object.values(d).flat()[0] : ''
      setError(typeof first === 'string' && first ? first : "Saqlab bo'lmadi. Qayta urinib ko'ring.")
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => { setPrices({}); setExtra(EXTRA); setSame(''); setPercent(''); setError('') }

  return (
    <div className="ws-detail-body ws-pop ws-bulk">
      <button type="button" className="btn btn-ghost ws-back" onClick={onBack}>← Ro'yxatga qaytish</button>
      <div className="ws-bulk-head">
        <h3>{num(books.length)} ta kitob tanlandi</h3>
        <button type="button" className="link-btn" onClick={onClear}>Tanlovni bekor qilish</button>
      </div>

      <div className="ws-bulk-tools card">
        <div className="ws-tool">
          <span>Hammasiga bir xil narx</span>
          <div className="ws-tool-row">
            <input type="number" min="1" step="1" inputMode="numeric" placeholder="so'm" aria-label="Hammasiga bir xil narx" value={same} onChange={(e) => setSame(e.target.value)} />
            <button type="button" className="btn btn-ghost" disabled={!sameOk} onClick={fillSame}>Qo'llash</button>
          </div>
        </div>
        <div className="ws-tool">
          <span>Foizga o'zgartirish ±%</span>
          <div className="ws-tool-row">
            <input type="number" min="-90" max="300" step="1" inputMode="numeric" placeholder="masalan 10 yoki -15" aria-label="Foiz" value={percent} onChange={(e) => setPercent(e.target.value)} />
            <button type="button" className="btn btn-ghost" disabled={!percentOk} onClick={fillPercent}>Qo'llash</button>
          </div>
        </div>
        <small className="field-hint ws-tools-hint">Bular faqat narx maydonlarini to'ldiradi. Saqlash pastdagi tugma bilan.</small>
      </div>

      <div className="ws-cards">
        {books.map((b) => (
          <BookCard
            key={b.id}
            book={b}
            price={priceOf(b)}
            onPrice={(v) => setPrice(b.id, v)}
            onOpen={onOpenBook}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="ws-extra card">
        <button type="button" className="ws-extra-toggle" aria-expanded={showExtra} onClick={() => setShowExtra((s) => !s)}>
          <span>{showExtra ? '▾' : '▸'}</span> Qo'shimcha: tannarx, ombor, holat {extraOn && <em className="ws-dot">to'ldirilgan</em>}
        </button>
        {showExtra && (
          <div className="ws-extra-body">
            <p className="muted ws-bulk-hint">Bo'sh maydon o'zgartirilmaydi. Bular barcha tanlangan kitobga qo'llanadi.</p>
            <label className="field ws-field">
              <span>Tannarx (so'm)</span>
              <input type="number" min="1" step="1" inputMode="numeric" placeholder="bo'sh = o'zgarmaydi" value={extra.cost} onChange={(e) => setExtraField('cost', e.target.value)} />
            </label>
            <div className="field ws-field">
              <span>Ombor soni</span>
              <select value={extra.stockMode} onChange={(e) => setExtraField('stockMode', e.target.value)}>
                <option value="">O'zgartirilmasin</option>
                <option value="set">Aniq qiymat qo'yish</option>
                <option value="add">+N qo'shish (to'ldirish)</option>
                <option value="unlimited">Cheklanmagan</option>
              </select>
              {(extra.stockMode === 'set' || extra.stockMode === 'add') && (
                <input type="number" min="0" step="1" inputMode="numeric" placeholder="soni" value={extra.stock} onChange={(e) => setExtraField('stock', e.target.value)} />
              )}
            </div>
            <label className="field ws-field">
              <span>Holat</span>
              <select value={extra.status} onChange={(e) => setExtraField('status', e.target.value)}>
                <option value="">O'zgartirilmasin</option>
                <option value="active">Faol</option>
                <option value="deactive">Faol emas</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {loss.length > 0 && <p className="field-warn">Diqqat: {loss.length} ta kitobda narx tannarxdan past bo'ladi (zarar bilan sotiladi).</p>}
      {dirty && problems.map((p) => <p key={p} className="alert">{p}</p>)}
      {error && <p className="alert">{error}</p>}
      {result && <p className="notice-ok" role="status">{result.updated} ta kitob yangilandi.</p>}

      <div className="ws-sticky">
        <button type="button" className="btn btn-primary" disabled={!dirty || busy || problems.length > 0} onClick={apply}>
          {busy ? 'Saqlanmoqda…' : `Saqlash (${affected} ta kitob)`}
        </button>
        <button type="button" className="btn btn-ghost" disabled={!dirty || busy} onClick={cancel}>Bekor qilish</button>
      </div>
    </div>
  )
}
