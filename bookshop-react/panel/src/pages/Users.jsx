import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getUsers } from '../api'
import { useFetch } from '../useFetch'
import { date, dateTime, money, num } from '../format'
import { Loading, Pagination, SortTh } from '../components/Bits'
import CsvButton from '../components/CsvButton'

const PAGE_SIZE = 20

export default function Users() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const q = params.get('q') || ''
  const staff = params.get('staff') || ''
  const ordering = params.get('ordering') || '-spent'
  const [search, setSearch] = useState(q)

  const key = `${page}|${q}|${staff}|${ordering}`
  const { data, error, loading } = useFetch(
    () => getUsers({ page, page_size: PAGE_SIZE, q: q || undefined, staff: staff || undefined, ordering }),
    key,
  )

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const sortProps = { ordering, onSort: (value) => update({ ordering: value }) }

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>Foydalanuvchilar</h1>
          <p className="muted">{data ? `${num(data.count)} ta foydalanuvchi` : ' '}. Qatorni bossangiz, uning buyurtmalari ochiladi.</p>
        </div>
      </div>

      <form className="filters card" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }) }}>
        <input placeholder="Login yoki email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={staff} onChange={(e) => update({ staff: e.target.value })}>
          <option value="">Hammasi</option>
          <option value="1">Faqat adminlar</option>
        </select>
        <button type="submit" className="btn btn-primary">Qidirish</button>
        {(q || staff) && <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Tozalash</button>}
        <CsvButton kind="users" params={{ q: q || undefined, staff: staff || undefined, ordering }} />
      </form>

      {!data ? <Loading error={error} /> : (
        <div className="card">
          {data.results.length === 0 ? <p className="muted">Foydalanuvchi topilmadi.</p> : (
            <div className="table-wrap">
              <table className="table clickable">
                <thead>
                  <tr>
                    <SortTh field="username" {...sortProps}>Foydalanuvchi</SortTh>
                    <SortTh field="date_joined" {...sortProps}>Ro'yxatdan o'tgan</SortTh>
                    <SortTh field="last_login" {...sortProps}>Oxirgi kirish</SortTh>
                    <SortTh field="orders_count" align="right" {...sortProps}>Buyurtmalar</SortTh>
                    <SortTh field="spent" align="right" {...sortProps}>Sarflagan</SortTh>
                    <SortTh field="last_order" {...sortProps}>Oxirgi buyurtma</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((u) => (
                    <tr key={u.id} onClick={() => navigate(`/orders?user=${u.id}`)}>
                      <td>
                        <strong>{u.username}</strong>
                        {u.is_staff && <span className="badge badge-staff">Admin</span>}
                        {!u.is_active && <span className="badge badge-cancelled">Bloklangan</span>}
                        <small className="sub">{u.email || '—'}</small>
                      </td>
                      <td>{date(u.date_joined)}</td>
                      <td>{u.last_login ? dateTime(u.last_login) : 'Kirmagan'}</td>
                      <td className="right">{num(u.orders_count)}</td>
                      <td className="right"><strong>{money(u.spent)}</strong></td>
                      <td>{u.last_order ? date(u.last_order) : '—'}</td>
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
