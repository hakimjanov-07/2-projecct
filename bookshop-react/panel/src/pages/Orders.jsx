import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getOrder, getOrders, setOrderStatus } from '../api'
import { useFetch } from '../useFetch'
import { dateTime, money, num, STAGES, STATUS_LABELS } from '../format'
import { Loading, Pagination, StatusBadge } from '../components/Bits'
import CsvButton from '../components/CsvButton'

const PAGE_SIZE = 20
const METHOD_LABELS = { pickup: 'Olib ketish', delivery: 'Yetkazib berish' }

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const status = params.get('status') || ''
  const q = params.get('q') || ''
  const user = params.get('user') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const orderId = params.get('order') || ''
  const [search, setSearch] = useState(q)

  const key = `${page}|${status}|${q}|${user}|${from}|${to}`
  const filters = { status: status || undefined, q: q || undefined, user: user || undefined, from: from || undefined, to: to || undefined }
  const { data, error, loading, reload } = useFetch(
    () => getOrders({ page, page_size: PAGE_SIZE, ...filters }),
    key,
  )

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes) && !('order' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const submit = (event) => {
    event.preventDefault()
    update({ q: search.trim() })
  }

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>Buyurtmalar</h1>
          <p className="muted">{data ? `${num(data.count)} ta buyurtma` : ' '}</p>
        </div>
      </div>

      <form className="filters card" onSubmit={submit}>
        <input placeholder="Qidirish: foydalanuvchi, email, promo kod yoki №" aria-label="Buyurtmalarni qidirish" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Holat bo'yicha filtr" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Barcha holatlar</option>
          {[...STAGES, 'cancelled'].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <label className="date-field">Dan <input className="date-input" type="date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} /></label>
        <label className="date-field">Gacha <input className="date-input" type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} /></label>
        <button type="submit" className="btn btn-primary">Qidirish</button>
        {(q || status || user || from || to) && (
          <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Tozalash</button>
        )}
        <CsvButton kind="orders" params={filters} />
        {user && <span className="chip">Foydalanuvchi #{user} <button type="button" onClick={() => update({ user: '' })} aria-label="Olib tashlash">✕</button></span>}
      </form>

      {!data ? <Loading error={error} /> : (
        <div className="card">
          {data.results.length === 0 ? <p className="muted">Buyurtma topilmadi.</p> : (
            <div className="table-wrap">
              <table className="table clickable">
                <thead>
                  <tr><th>№</th><th>Mijoz</th><th>Sana</th><th>Usul</th><th className="right">Kitoblar</th><th className="right">Chegirma</th><th className="right">Summa</th><th>Holat</th></tr>
                </thead>
                <tbody>
                  {data.results.map((o) => (
                    <tr
                      key={o.id}
                      data-order-row={o.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Buyurtma #${o.id} ni ochish`}
                      onClick={() => update({ order: String(o.id) })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          update({ order: String(o.id) })
                        }
                      }}
                    >
                      <td><strong>#{o.id}</strong></td>
                      <td>{o.username}<small className="sub">{o.email}</small></td>
                      <td>{dateTime(o.created_on)}</td>
                      <td>{METHOD_LABELS[o.delivery_method] || '—'}</td>
                      <td className="right">{num(o.items_count)}</td>
                      <td className="right">{o.discount ? `−${money(o.discount)}` : '—'}</td>
                      <td className="right"><strong>{money(o.total)}</strong></td>
                      <td><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}

      {orderId && <OrderDrawer id={orderId} onClose={() => update({ order: '' })} onChanged={reload} />}
    </div>
  )
}

function OrderDrawer({ id, onClose, onChanged }) {
  const { data, error, reload } = useFetch(() => getOrder(id), id)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const change = async (next, question) => {
    if (!window.confirm(question)) return
    setBusy(true)
    setMessage('')
    try {
      await setOrderStatus(id, next)
      reload()
      onChanged()
      window.dispatchEvent(new Event('panel-orders-changed')) // yon menyudagi badge qayta yuklansin
    } catch {
      setMessage("Holatni o'zgartirib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  // Fokus: ochilganda oynaga, yopilganda (Escape/✕/backdrop) ochgan qatorga qaytadi
  const drawerRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const opener = document.activeElement
    drawerRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const row = document.querySelector(`[data-order-row="${id}"]`)
      if (row) row.focus()
      else if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [id])

  const stageIndex = data ? STAGES.indexOf(data.status) : -1
  const nextStage = stageIndex >= 0 && stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" ref={drawerRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Buyurtma #${id}`}>
        <header className="drawer-head">
          <h2>Buyurtma #{id}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Yopish">✕</button>
        </header>

        {!data ? <Loading error={error} /> : (
          <div className="drawer-body">
            <div className="kv">
              <div><span>Holat</span><StatusBadge status={data.status} /></div>
              <div><span>Mijoz</span><strong>{data.username}</strong></div>
              <div><span>Email</span><strong>{data.email || '—'}</strong></div>
              <div><span>Sana</span><strong>{dateTime(data.created_on)}</strong></div>
              <div><span>Promo kod</span><strong>{data.promo_code || '—'}</strong></div>
            </div>

            <h3>Qabul qilish</h3>
            <div className="kv">
              <div><span>Usul</span><strong>{METHOD_LABELS[data.delivery_method] || '—'}</strong></div>
              <div><span>Qabul qiluvchi</span><strong>{data.recipient_name || '—'}</strong></div>
              <div><span>Telefon</span><strong>{data.recipient_phone || '—'}</strong></div>
              {data.delivery_method === 'delivery' && <div><span>Manzil</span><strong>{data.address || '—'}</strong></div>}
              {data.delivery_comment && <div><span>Izoh</span><strong>{data.delivery_comment}</strong></div>}
              {data.delivery_lat != null && data.delivery_lng != null && (
                <div>
                  <span>Xarita</span>
                  <strong>
                    <a href={`https://www.openstreetmap.org/?mlat=${data.delivery_lat}&mlon=${data.delivery_lng}#map=17/${data.delivery_lat}/${data.delivery_lng}`} target="_blank" rel="noopener noreferrer">
                      Xaritada ochish
                    </a>
                  </strong>
                </div>
              )}
            </div>

            {data.status !== 'cancelled' && (
              <>
                <h3>Bosqich</h3>
                <ol className="stages">
                  {STAGES.map((stage, index) => (
                    <li key={stage} className={`${index <= stageIndex ? 'done' : ''} ${index === stageIndex ? 'now' : ''}`}>
                      <button
                        type="button"
                        className="stage-dot"
                        disabled={busy || index === stageIndex}
                        title={`${STATUS_LABELS[stage]} qilish`}
                        onClick={() => change(stage, `Buyurtma holati "${STATUS_LABELS[stage]}" ga o'zgartirilsinmi?`)}
                      >
                        {index < stageIndex ? '✓' : index + 1}
                      </button>
                      {STATUS_LABELS[stage]}
                    </li>
                  ))}
                </ol>
              </>
            )}

            <h3>Kitoblar</h3>
            <ul className="order-items">
              {data.items.map((item) => (
                <li key={item.id}>
                  <div className="thumb">{item.book_photo ? <img src={item.book_photo} alt="" /> : '📗'}</div>
                  <div className="grow">
                    <strong>{item.book_name}</strong>
                    <small className="sub">{money(item.price)} × {item.quantity}
                      {item.profit !== null && <> · foyda {money(item.profit)}</>}</small>
                  </div>
                  <strong>{money(item.line_total)}</strong>
                </li>
              ))}
            </ul>

            <dl className="sums">
              <div><dt>Mahsulotlar</dt><dd>{money(data.goods_total)}</dd></div>
              {data.discount > 0 && <div className="green"><dt>Chegirma</dt><dd>−{money(data.discount)}</dd></div>}
              <div><dt>Yetkazib berish</dt><dd>{data.delivery_method === 'pickup' ? 'Olib ketish – bepul' : data.delivery_fee > 0 ? money(data.delivery_fee) : 'Bepul'}</dd></div>
              <div className="grand"><dt>Jami</dt><dd>{money(data.total)}</dd></div>
              {data.status !== 'cancelled' && (
                <div><dt>Sof tushum{data.missing_cost_count > 0 ? ' (tannarxsiz qatorlarsiz)' : ''}</dt><dd>{money(data.net_revenue)}</dd></div>
              )}
            </dl>

            <h3>Tarix</h3>
            <ul className="timeline">
              {data.events.map((event, index) => (
                <li key={`${event.status}-${index}`}>
                  <StatusBadge status={event.status} />
                  <span>{dateTime(event.created_on)}</span>
                </li>
              ))}
            </ul>

            {message && <p className="alert">{message}</p>}
            <div className="drawer-actions">
              {data.status === 'cancelled' ? (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => change('confirmed', 'Buyurtmani qayta tasdiqlaysizmi?')}>Qayta tasdiqlash</button>
              ) : (
                <>
                  {nextStage && (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => change(nextStage, `Buyurtma holati "${STATUS_LABELS[nextStage]}" ga o'zgartirilsinmi?`)}>
                      Keyingi bosqich: {STATUS_LABELS[nextStage]} →
                    </button>
                  )}
                  {data.status !== 'delivered' && (
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => change('cancelled', 'Buyurtmani bekor qilasizmi?')}>Bekor qilish</button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
