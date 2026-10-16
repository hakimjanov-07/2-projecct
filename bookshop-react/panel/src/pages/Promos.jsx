import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPromo, deletePromo, getPromos, updatePromo } from '../api'
import { useFetch } from '../useFetch'
import { date, money, num } from '../format'
import { Loading, Pagination, SortTh } from '../components/Bits'

const PAGE_SIZE = 20

// Xato javobidan birinchi tushunarli xabarni oladi
const firstError = (err, fallback) => {
  const data = err.response?.data
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  const value = Object.values(data)[0]
  return Array.isArray(value) ? value[0] : fallback
}

export default function Promos() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const q = params.get('q') || ''
  const active = params.get('active') || ''
  const ordering = params.get('ordering') || '-created_on'
  const [search, setSearch] = useState(q)
  const [form, setForm] = useState({ code: '', discount_percent: '' })
  const [editing, setEditing] = useState(null) // { id, value }
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const key = `${page}|${q}|${active}|${ordering}`
  const { data, error, loading, reload } = useFetch(
    () => getPromos({ page, page_size: PAGE_SIZE, q: q || undefined, active: active || undefined, ordering }),
    key,
  )

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const run = async (action, fallback) => {
    setMessage('')
    try {
      await action()
      reload()
      return true
    } catch (err) {
      setMessage(firstError(err, fallback))
      return false
    }
  }

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    const ok = await run(() => createPromo({ code: form.code.trim(), discount_percent: Number(form.discount_percent) }), "Qo'shib bo'lmadi.")
    if (ok) setForm({ code: '', discount_percent: '' })
    setBusy(false)
  }

  const savePercent = async (promo) => {
    const ok = await run(() => updatePromo(promo.id, { discount_percent: Number(editing.value) }), "Saqlab bo'lmadi.")
    if (ok) setEditing(null)
  }

  const remove = (promo) => {
    if (!window.confirm(`"${promo.code}" promo kodini o'chirasizmi?`)) return
    run(() => deletePromo(promo.id), "O'chirib bo'lmadi.")
  }

  const sortProps = { ordering, onSort: (value) => update({ ordering: value }) }

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>Promo kodlar</h1>
          <p className="muted">Mijozlar savatda shu kodni kiritib chegirma oladi. Statistika bekor qilinmagan buyurtmalardan hisoblanadi.</p>
        </div>
      </div>

      <form className="filters card" onSubmit={create}>
        <input
          placeholder="Yangi kod, masalan YOZ20"
          value={form.code}
          maxLength={32}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          required
        />
        <input
          className="percent-input"
          type="number"
          min="1"
          max="100"
          placeholder="Chegirma %"
          value={form.discount_percent}
          onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>+ Qo'shish</button>
      </form>

      <form className="filters card" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }) }}>
        <input placeholder="Kod bo'yicha qidirish" aria-label="Promo kod bo'yicha qidirish" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Faollik bo'yicha filtr" value={active} onChange={(e) => update({ active: e.target.value })}>
          <option value="">Hammasi</option>
          <option value="1">Faqat faol</option>
          <option value="0">Faol emas</option>
        </select>
        <button type="submit" className="btn btn-primary">Qidirish</button>
        {(q || active) && <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Tozalash</button>}
      </form>

      {message && <p className="alert">{message}</p>}

      {!data ? <Loading error={error} /> : (
        <div className="card">
          {data.results.length === 0 ? <p className="muted">Promo kod topilmadi.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh field="code" {...sortProps}>Kod</SortTh>
                    <SortTh field="discount_percent" align="right" {...sortProps}>Chegirma</SortTh>
                    <th>Faol</th>
                    <SortTh field="orders_count" align="right" {...sortProps}>Ishlatilgan</SortTh>
                    <SortTh field="discount_given" align="right" {...sortProps}>Berilgan chegirma</SortTh>
                    <SortTh field="revenue" align="right" {...sortProps}>Buyurtmalar summasi</SortTh>
                    <SortTh field="created_on" {...sortProps}>Yaratilgan</SortTh>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((p) => (
                    <tr key={p.id}>
                      <td><strong className="code-tag">{p.code}</strong></td>
                      <td className="right">
                        {editing?.id === p.id ? (
                          <input
                            className="inline-input"
                            type="number"
                            min="1"
                            max="100"
                            autoFocus
                            value={editing.value}
                            onChange={(e) => setEditing({ id: p.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') savePercent(p)
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            onBlur={() => setEditing(null)}
                          />
                        ) : (
                          <button type="button" className="link-btn" title="Foizni o'zgartirish" onClick={() => setEditing({ id: p.id, value: p.discount_percent })}>
                            {p.discount_percent}% ✎
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`switch ${p.is_active ? 'on' : ''}`}
                          aria-pressed={p.is_active}
                          title={p.is_active ? "Faol: o'chirish" : 'Faol emas: yoqish'}
                          onClick={() => run(() => updatePromo(p.id, { is_active: !p.is_active }), "Saqlab bo'lmadi.")}
                        >
                          <span />
                        </button>
                      </td>
                      <td className="right">{num(p.orders_count)}</td>
                      <td className="right">{p.discount_given ? `−${money(p.discount_given)}` : '—'}</td>
                      <td className="right">{money(p.revenue)}</td>
                      <td>{date(p.created_on)}</td>
                      <td className="right">
                        <button type="button" className="btn btn-ghost" onClick={() => remove(p)} title="O'chirish (faqat ishlatilmagan kod)">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onChange={(n) => update({ page: String(n) })} />
        </div>
      )}
    </div>
  )
}
