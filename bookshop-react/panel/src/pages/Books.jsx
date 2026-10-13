import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getBooks, updateBook } from '../api'
import { useFetch } from '../useFetch'
import { date, money, num } from '../format'
import { Loading, Pagination, SortTh } from '../components/Bits'
import CsvButton from '../components/CsvButton'

const PAGE_SIZE = 20
const LOW = 5

export default function Books() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const stock = params.get('stock') || ''
  const ordering = params.get('ordering') || '-sold'
  const [search, setSearch] = useState(q)
  const [editing, setEditing] = useState(null) // { id, field: 'price' | 'stock', value }
  const [message, setMessage] = useState('')

  const key = `${page}|${q}|${status}|${stock}|${ordering}`
  const { data, error, loading, reload } = useFetch(
    () => getBooks({ page, page_size: PAGE_SIZE, q: q || undefined, status: status || undefined, stock: stock || undefined, ordering }),
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
      const data = err.response?.data
      setMessage(data?.price?.[0] || data?.stock?.[0] || "Saqlab bo'lmadi.")
    }
  }

  const commit = (book) => {
    if (editing.field === 'stock') {
      // bo'sh qoldirilsa, qoldiq hisoblanmaydi (cheklanmagan)
      save(book, { stock: editing.value === '' ? null : Number(editing.value) })
    } else {
      save(book, { price: Number(editing.value) })
    }
  }

  const sortProps = { ordering, onSort: (value) => update({ ordering: value }) }

  const editor = (book, field) => (
    <input
      className="inline-input"
      type="number"
      min="0"
      autoFocus
      placeholder={field === 'stock' ? 'cheklanmagan' : ''}
      value={editing.value}
      onChange={(e) => setEditing({ id: book.id, field, value: e.target.value })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(book)
        if (e.key === 'Escape') setEditing(null)
      }}
      onBlur={() => setEditing(null)}
    />
  )

  const isEditing = (book, field) => editing?.id === book.id && editing.field === field

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>Kitoblar</h1>
          <p className="muted">Sotuv statistikasi. Narx, ombor qoldig'i va holatni shu yerda o'zgartirish mumkin; boshqa maydonlar Django adminda. Ombor bo'sh bo'lsa, qoldiq hisoblanmaydi.</p>
        </div>
      </div>

      <form className="filters card" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }) }}>
        <input placeholder="Kitob yoki muallif nomi" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="deactive">Faol emas</option>
        </select>
        <select value={stock} onChange={(e) => update({ stock: e.target.value })}>
          <option value="">Ombor: hammasi</option>
          <option value="low">Kam qolgan (≤ {LOW})</option>
          <option value="out">Tugagan</option>
          <option value="tracked">Qoldig'i hisoblanadiganlar</option>
        </select>
        <button type="submit" className="btn btn-primary">Qidirish</button>
        {(q || status || stock) && <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Tozalash</button>}
        <CsvButton kind="books" params={{ q: q || undefined, status: status || undefined, stock: stock || undefined, ordering }} />
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
                    <SortTh field="stock" align="right" {...sortProps}>Ombor</SortTh>
                    <th>Fayllar</th>
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
                        {isEditing(b, 'price') ? editor(b, 'price') : (
                          <button type="button" className="link-btn" title="Narxni o'zgartirish" onClick={() => setEditing({ id: b.id, field: 'price', value: b.price ?? '' })}>
                            {b.price ? money(b.price) : "Narx yo'q"} ✎
                          </button>
                        )}
                      </td>
                      <td className="right">
                        {isEditing(b, 'stock') ? editor(b, 'stock') : (
                          <button
                            type="button"
                            className={`link-btn ${b.stock === 0 ? 'stock-out' : b.stock !== null && b.stock <= LOW ? 'stock-low' : ''}`}
                            title="Ombor qoldig'ini o'zgartirish"
                            onClick={() => setEditing({ id: b.id, field: 'stock', value: b.stock ?? '' })}
                          >
                            {b.stock === null ? 'cheklanmagan' : b.stock === 0 ? 'Tugagan' : `${num(b.stock)} ta`} ✎
                          </button>
                        )}
                      </td>
                      <td title="Audio va PDF Django adminda yuklanadi">{b.has_audio ? '🎧' : '·'} {b.has_pdf ? '📄' : '·'}</td>
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
