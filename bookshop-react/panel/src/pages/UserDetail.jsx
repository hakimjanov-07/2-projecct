import { Link, useNavigate, useParams } from 'react-router-dom'
import { getUser } from '../api'
import { useFetch } from '../useFetch'
import { date, dateTime, money, num } from '../format'
import { Loading, StatCard, StatusBadge } from '../components/Bits'

function Items({ items }) {
  return (
    <ul className="line-list">
      {items.map((i) => (
        <li key={i.id}>{i.book_name} <span className="muted">× {num(i.quantity)} · {money(i.price)}</span></li>
      ))}
    </ul>
  )
}

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useFetch(() => getUser(id), id)

  const back = <button type="button" className="btn btn-ghost" onClick={() => navigate('/users')}>← Orqaga</button>

  if (!data) {
    const notFound = error?.response?.status === 404
    return (
      <div>
        <div className="page-head">{back}</div>
        {notFound ? <p className="alert">Foydalanuvchi topilmadi.</p> : <Loading error={error} />}
      </div>
    )
  }

  const { profile: p, stats: s, orders, reviews, cart } = data

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>
            {p.username}
            {p.is_staff && <span className="badge badge-staff">Admin</span>}
            {!p.is_active && <span className="badge badge-cancelled">Bloklangan</span>}
          </h1>
          <p className="muted">{p.email || 'Email kiritilmagan'}</p>
        </div>
        {back}
      </div>

      <section className="card">
        <div className="card-head"><h2>Profil</h2></div>
        <dl className="profile-grid">
          <div><dt>Ism familiya</dt><dd>{p.full_name || '—'}</dd></div>
          <div><dt>Telefon</dt><dd>{p.phone || '—'}</dd></div>
          <div><dt>Manzil</dt><dd>{p.address || '—'}</dd></div>
          <div><dt>Ro'yxatdan o'tgan</dt><dd>{dateTime(p.date_joined)}</dd></div>
          <div><dt>Oxirgi kirish</dt><dd>{p.last_login ? dateTime(p.last_login) : 'Kirmagan'}</dd></div>
          {p.bio && <div><dt>Haqida</dt><dd>{p.bio}</dd></div>}
        </dl>
      </section>

      <div className="grid stats" style={{ marginTop: 20 }}>
        <StatCard title="Buyurtmalar" value={num(s.orders_count)} hint={`${num(s.cancelled_count)} ta bekor qilingan`} />
        <StatCard title="Jami sarflagan" value={money(s.spent)} />
        <StatCard title="O'rtacha chek" value={money(s.average)} />
        <StatCard title="Oxirgi buyurtma" value={s.last_order ? date(s.last_order) : '—'} />
        <StatCard title="Ishlatgan promo kodlar" value={s.promo_codes.length ? num(s.promo_codes.length) : '—'}>
          {s.promo_codes.length > 0 && <span>{s.promo_codes.map((c) => <span key={c} className="code-tag">{c}</span>)}</span>}
        </StatCard>
      </div>

      <section className="card">
        <div className="card-head"><h2>Buyurtmalar ({num(orders.length)})</h2></div>
        {orders.length === 0 ? <p className="muted">Hali buyurtma yo'q.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>№</th><th>Sana</th><th>Holat</th><th>Mahsulotlar</th><th className="right">Summa</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="link-btn" to={`/orders?order=${o.id}`}>#{o.id}</Link></td>
                    <td>{dateTime(o.created_on)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <Items items={o.items} />
                      {o.promo_code && <small className="sub">Promo: {o.promo_code} (−{money(o.discount)})</small>}
                    </td>
                    <td className="right">
                      <strong>{money(o.total)}</strong>
                      {o.delivery_fee > 0 && <small className="sub">yetkazib berish {money(o.delivery_fee)}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Joriy savat</h2></div>
        {!cart || cart.items.length === 0 ? <p className="muted">Savat bo'sh.</p> : (
          <>
            <Items items={cart.items} />
            <p><strong>Jami: {money(cart.goods_total)}</strong></p>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Sharhlar ({num(reviews.length)})</h2></div>
        {reviews.length === 0 ? <p className="muted">Hali sharh yozmagan.</p> : (
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id}>
                <strong>{r.book_name}</strong> <span className="stars" aria-label={`${r.rating} / 5`}>{'★'.repeat(Math.max(0, Math.min(5, r.rating)))}{'☆'.repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                <small className="sub">{dateTime(r.created_on)}</small>
                <p>{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
