import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMyOrders } from '../api'
import OrderProgress from '../components/OrderProgress'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Profile.module.css'

// Xaridlarim: foydalanuvchining buyurtmalar tarixi
export default function Orders() {
  const { t, locale } = useLang()
  useDocumentTitle(t('title.orders'))
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordersError, setOrdersError] = useState(false)

  const isLoggedIn = Boolean(localStorage.getItem('access_token'))
  const money = (value) => `${Number(value || 0).toLocaleString(locale)} ${t('currency')}`

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/orders' } })
      return
    }

    getMyOrders()
      .then((response) => setOrders(response.data.results || response.data))
      .catch((error) => {
        if (error.response?.status === 401) navigate('/login', { state: { from: '/orders' } })
        else setOrdersError(true)
      })
      .finally(() => setLoading(false))
  }, [isLoggedIn, navigate])

  return (
    <main className={styles.page}>
      <div className={styles.single}>
        <div className={styles.panel} data-reveal>
          <h2>{t('profile.historyTitle')}</h2>

          {ordersError && <p className={styles.errorBox}>{t('profile.ordersError')}</p>}

          {!loading && !ordersError && orders.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyIcon} aria-hidden="true">🛍</p>
              <p>{t('profile.noPurchases')}</p>
              <Link to="/books" className={styles.primaryLink}>{t('profile.toCatalog')}</Link>
            </div>
          )}

          <div className={styles.orders}>
            {orders.map((order) => (
              <article key={order.id} className={styles.order} data-reveal>
                <header className={styles.orderHead}>
                  <div>
                    <strong>{t('profile.orderNo', { n: order.id })}</strong>
                    <time dateTime={order.created_on}>{new Date(order.created_on).toLocaleDateString(locale)}</time>
                  </div>
                  <span className={`${styles.status} ${styles[`status_${order.status}`] || ''}`}>
                    {t(`order.${order.status}`)}
                  </span>
                </header>

                <OrderProgress order={order} t={t} locale={locale} />

                <ul className={styles.items}>
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <Link to={`/books/${item.book}`} className={styles.thumb}>
                        {item.book_photo ? <img src={item.book_photo} alt="" loading="lazy" /> : <span>📗</span>}
                      </Link>
                      <div className={styles.itemInfo}>
                        <Link to={`/books/${item.book}`}>{item.book_name}</Link>
                        <span>{money(item.price)} × {item.quantity}</span>
                      </div>
                      <strong>{money((item.price || 0) * item.quantity)}</strong>
                    </li>
                  ))}
                </ul>

                <dl className={styles.sums}>
                  <div><dt>{t('cart.products')}</dt><dd>{money(order.subtotal)}</dd></div>
                  {order.discount > 0 && (
                    <div className={styles.green}>
                      <dt>{t('cart.discount')}{order.promo_code ? ` (${order.promo_code})` : ''}</dt>
                      <dd>−{money(order.discount)}</dd>
                    </div>
                  )}
                  <div><dt>{t('cart.delivery')}</dt><dd>{order.delivery_method === 'pickup' ? t('cart.pickupFree') : order.delivery_fee > 0 ? money(order.delivery_fee) : t('cart.free')}</dd></div>
                  <div className={styles.grand}><dt>{t('cart.total')}</dt><dd>{money(order.total_price)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
