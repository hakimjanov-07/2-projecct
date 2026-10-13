import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getBooks, updateBook } from '../api'
import { useFetch } from '../useFetch'
import { date, money, num } from '../format'
import { Loading, Pagination, SortTh } from '../components/Bits'

const PAGE_SIZE = 20

export default function Books() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const ordering = params.get('ordering') || '-sold'
  const [search, setSearch] = useState(q)
  const [editing, setEditing] = useState(null) // { id, value }
  const [message, setMessage] = useState('')

  const key = `${page}|${q}|${status}|${ordering}`
  const { data, error, loading, reload } = useFetch(
    () => getBooks({ page, page_size: PAGE_SIZE, q: q || undefined, status: status || undefined, ordering }),
    key,
  )

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const save = async (book, patch) => {
    setMessage('')
    try {
      await updateBook(book.id, patch)
      setEditing(null)
      reload()
    } catch (err) {
      setMessage(err.response?.data?.price?.[0] || "Saqlab bo'lmadi.")
    }
  }

  const sortProps = { ordering, onSort: (value) => update({ ordering: value }) }

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>Kitoblar</h1>
          <p className="muted">Sotuv statistikasi. Narx va holatni shu yerda o'zgartirish mumkin; boshqa maydonlar Django adminda.</p>
        </div>
      </div>

      <form className="filters card" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }) }}>
        <input placeholder="Kitob yoki muallif nomi" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="deactive">Faol emas</option>
        </select>
        <button type="submit" className="btn btn-primary">Qidirish</button>
        {(q || status) && <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Tozalash</button>}
      </form>

      {message && <p className="alert">{message}</p>}

      {!data ? <Loading error={error} /> : (
        <div className="card">
          {data.results.length === 0 ? <p className="muted">Kitob topilmadi.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <SortTh field="name" {...sortProps}>Kitob</SortTh>
                    <th>Janr</th>
                    <SortTh field="price" align="right" {...sortProps}>Narx</SortTh>
                    <th>Holat</th>
                    <SortTh field="sold" align="right" {...sortProps}>Sotilgan</SortTh>
                    <SortTh field="revenue" align="right" {...sortProps}>Tushum</SortTh>
                    <SortTh field="orders_count" align="right" {...sortProps}>Buyurtma</SortTh>
                    <SortTh field="created_on" {...sortProps}>Qo'shilgan</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((b) => (
                    <tr key={b.id}>
                      <td><strong>{b.name}</strong><small className="sub">{b.author_name}</small></td>
                      <td>{b.category_name}</td>
                      <td className="right">
                        {editing?.id === b.id ? (
                          <input
                            className="inline-input"
                            type="number"
                            min="0"
                            autoFocus
                            value={editing.value}
                            onChange={(e) => setEditing({ id: b.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') save(b, { price: Number(editing.value) })
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            onBlur={() => setEditing(null)}
                          />
                        ) : (
                          <button type="button" className="link-btn" title="Narxni o'zgartirish" onClick={() => setEditing({ id: b.id, value: b.price ?? '' })}>
                            {b.price ? money(b.price) : 'Narx yo\'q'} ✎
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`switch ${b.status === 'active' ? 'on' : ''}`}
                          aria-pressed={b.status === 'active'}
                          title={b.status === 'active' ? "Faol: o'chirish" : 'Faol emas: yoqish'}
                          onClick={() => save(b, { status: b.status === 'active' ? 'deactive' : 'active' })}
                        >
                          <span />
                        </button>
                      </td>
                      <td className="right">{num(b.sold)}</td>
                      <td className="right">{money(b.revenue)}</td>
                      <td className="right">{num(b.orders_count)}</td>
                      <td>{date(b.created_on)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </div>
  )
}
