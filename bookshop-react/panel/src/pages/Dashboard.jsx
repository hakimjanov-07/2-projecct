import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getSummary } from '../api'
import { useFetch } from '../useFetch'
import { dateTime, money, num } from '../format'
import Chart from '../components/Chart'
import { Growth, Loading, StatCard, StatusBadge } from '../components/Bits'

const PERIODS = [
  { days: 7, label: '7 kun' },
  { days: 30, label: '30 kun' },
  { days: 90, label: '90 kun' },
  { days: 365, label: '1 yil' },
]

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const { data, error, loading } = useFetch(() => getSummary(days), days)

  if (!data) return <Loading error={error} />

  const { current: cur, growth, totals, carts } = data
  const revenueSeries = data.series.map((d) => ({ date: d.date, value: d.revenue }))
  const ordersSeries = data.series.map((d) => ({ date: d.date, value: d.orders }))
  const maxCategory = Math.max(...data.categories.map((c) => c.revenue), 1)
  const statusTotal = data.statuses.reduce((sum, s) => sum + s.count, 0) || 1

  return (
    <div className={loading ? 'is-loading' : ''}>
      <div className="page-head">
        <div>
          <h1>Boshqaruv</h1>
          <p className="muted">Tushum faqat tasdiqlangan buyurtmalardan hisoblanadi. Savatdagi kitoblar buyurtma emas.</p>
        </div>
        <div className="segmented" role="group" aria-label="Davr">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" className={days === p.days ? 'active' : ''} onClick={() => setDays(p.days)}>{p.label}</button>
          ))}
        </div>
      </div>

      <section className="grid stats">
        <StatCard title="Tushum" value={money(cur.revenue)}>
          <Growth value={growth.revenue} />
        </StatCard>
        <StatCard title="Buyurtmalar" value={num(cur.count)} hint={`${num(cur.cancelled)} tasi bekor qilingan`}>
          <Growth value={growth.orders} />
        </StatCard>
        <StatCard title="O'rtacha buyurtma" value={money(cur.avg_order)} hint="bitta buyurtma summasi" />
        <StatCard title="Sotilgan kitoblar" value={num(cur.books)} hint="dona" />
        <StatCard title="Yangi foydalanuvchilar" value={num(data.new_users)} hint={`jami ${num(totals.users)} ta`} />
        <StatCard title="Savatlarda" value={num(carts.count)} hint={`${money(carts.value)} (sotib olinmagan)`} />
        <StatCard title="Chegirmalar" value={money(cur.discounts)} hint="promo kodlar hisobidan" />
        <StatCard title="Yetkazib berishdan" value={money(cur.delivery)} hint="yetkazib berish to'lovlari" />
        <StatCard
          title="Omborda kam / tugagan"
          value={`${num(data.stock.low)} / ${num(data.stock.out)}`}
          hint={data.stock.tracked ? `${num(data.stock.tracked)} ta kitob qoldig'i hisoblanadi` : "Qoldiq hali kiritilmagan"}
        />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Tushum dinamikasi</h2>
          <Chart data={revenueSeries} kind="area" label="revenue" format={money} />
        </div>
        <div className="card">
          <h2>Buyurtmalar soni</h2>
          <Chart data={ordersSeries} kind="bar" label="orders" format={(v) => `${v} ta`} axisFormat={String} />
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Eng ko'p sotilgan kitoblar</h2>
          {data.top_books.length === 0 ? <p className="muted">Bu davrda sotuv bo'lmagan.</p> : (
            <table className="table">
              <thead><tr><th>Kitob</th><th className="right">Dona</th><th className="right">Tushum</th></tr></thead>
              <tbody>
                {data.top_books.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong><small className="sub">{b.author}</small></td>
                    <td className="right">{num(b.qty)}</td>
                    <td className="right">{money(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Janrlar bo'yicha tushum</h2>
          {data.categories.length === 0 ? <p className="muted">Bu davrda sotuv bo'lmagan.</p> : (
            <ul className="bars">
              {data.categories.map((c) => (
                <li key={c.name}>
                  <div className="bars-row"><span>{c.name}</span><strong>{money(c.revenue)}</strong></div>
                  <div className="bar"><span style={{ width: `${(c.revenue / maxCategory) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Eng faol xaridorlar</h2>
          {data.top_customers.length === 0 ? <p className="muted">Bu davrda xarid bo'lmagan.</p> : (
            <table className="table">
              <thead><tr><th>Foydalanuvchi</th><th className="right">Buyurtma</th><th className="right">Sarflagan</th></tr></thead>
              <tbody>
                {data.top_customers.map((u) => (
                  <tr key={u.id}>
                    <td><Link to={`/orders?user=${u.id}`}><strong>{u.username}</strong></Link><small className="sub">{u.email}</small></td>
                    <td className="right">{num(u.orders)}</td>
                    <td className="right">{money(u.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Buyurtma holatlari</h2>
          <ul className="bars">
            {data.statuses.map((s) => (
              <li key={s.status}>
                <div className="bars-row"><StatusBadge status={s.status} /><strong>{num(s.count)} ta · {money(s.sum)}</strong></div>
                <div className="bar"><span className={s.status === 'cancelled' ? 'danger' : ''} style={{ width: `${(s.count / statusTotal) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="totals">
            <div><span>Jami tushum</span><strong>{money(totals.revenue)}</strong></div>
            <div><span>Jami buyurtma</span><strong>{num(totals.orders)}</strong></div>
            <div><span>Kitoblar</span><strong>{num(totals.books)}</strong></div>
          </div>
        </div>
      </section>

      {data.stock.low_books.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Omborda kam qolgan kitoblar (≤ {data.stock.threshold})</h2>
            <Link to="/books?stock=low" className="btn btn-ghost">Hammasi →</Link>
          </div>
          <ul className="bars">
            {data.stock.low_books.map((b) => (
              <li key={b.id}>
                <div className="bars-row">
                  <span>{b.name}</span>
                  <strong className={b.stock === 0 ? 'stock-out' : 'stock-low'}>{b.stock === 0 ? 'Tugagan' : `${b.stock} ta`}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>So'nggi buyurtmalar</h2>
          <Link to="/orders" className="btn btn-ghost">Hammasi →</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>№</th><th>Mijoz</th><th>Sana</th><th className="right">Kitoblar</th><th className="right">Summa</th><th>Holat</th></tr></thead>
            <tbody>
              {data.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/orders?order=${o.id}`}>#{o.id}</Link></td>
                  <td>{o.username}</td>
                  <td>{dateTime(o.created_on)}</td>
                  <td className="right">{num(o.items_count)}</td>
                  <td className="right">{money(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
