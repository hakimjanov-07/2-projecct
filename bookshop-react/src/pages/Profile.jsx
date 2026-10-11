import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { clearSession, getBooks, getMyOrders } from '../api'
import { useFavorites } from '../context/FavoritesContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './Profile.module.css'

const PROFILE_KEY = 'bookshop-profile'
const TABS = ['info', 'orders', 'favorites']

const readProfile = () => {
  let saved
  try {
    saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')
  } catch {
    saved = {}
  }
  return {
    fullName: saved.fullName || localStorage.getItem('username') || '',
    email: saved.email || localStorage.getItem('user_email') || '',
    phone: saved.phone || '',
    address: saved.address || '',
    bio: saved.bio || '',
  }
}

export default function Profile() {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { showToast } = useToast()
  const [profile, setProfile] = useState(readProfile)
  const [orders, setOrders] = useState([])
  const [books, setBooks] = useState([])
  const [ordersError, setOrdersError] = useState(false)
  const [saved, setSaved] = useState(false)

  const requested = searchParams.get('tab')
  const tab = TABS.includes(requested) ? requested : 'info'
  const isLoggedIn = Boolean(localStorage.getItem('access_token'))
  const money = (value) => `${Number(value || 0).toLocaleString(locale)} ${t('currency')}`

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/profile' } })
      return
    }

    getMyOrders()
      .then((response) => setOrders(response.data.results || response.data))
      .catch((error) => {
        if (error.response?.status === 401) navigate('/login', { state: { from: '/profile' } })
        else setOrdersError(true)
      })

    getBooks({ page_size: 100 })
      .then((response) => setBooks(response.data.results || []))
      .catch(() => setBooks([]))
  }, [isLoggedIn, navigate])

  const favoriteBooks = useMemo(
    () => favoriteIds.map((id) => books.find((book) => book.id === id)).filter(Boolean),
    [books, favoriteIds]
  )

  const stats = useMemo(() => ({
    orders: orders.length,
    books: orders.reduce((sum, order) => sum + (order.total_items || 0), 0),
    spent: orders.reduce((sum, order) => sum + (order.total_price || 0), 0),
  }), [orders])

  const handleChange = (event) => {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
  }

  const handleSave = (event) => {
    event.preventDefault()
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
      if (profile.email) localStorage.setItem('user_email', profile.email)
    } catch {
      // Brauzer xotirasi mavjud bo'lmasa, o'zgarish faqat shu sessiyada qoladi.
    }
    setSaved(true)
    showToast(t('toast.profileSaved'))
    setTimeout(() => setSaved(false), 1800)
  }

  const logout = () => {
    clearSession()
    window.location.assign('/')
  }

  const selectTab = (key) => setSearchParams(key === 'info' ? {} : { tab: key }, { replace: true })

  const displayName = profile.fullName || localStorage.getItem('username') || ''
  const initial = (displayName.charAt(0) || '?').toUpperCase()

  const tabLabels = {
    info: t('profile.tabInfo'),
    orders: `${t('profile.tabOrders')}${orders.length ? ` (${orders.length})` : ''}`,
    favorites: `${t('profile.tabFavorites')}${favoriteIds.length ? ` (${favoriteIds.length})` : ''}`,
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <aside className={styles.sidebar} data-reveal>
          <div className={styles.avatar} aria-hidden="true">{initial}</div>
          <h1 className={styles.name}>{displayName}</h1>
          {profile.email && <p className={styles.email}>{profile.email}</p>}
          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

          <dl className={styles.facts}>
            <div>
              <dt>{t('profile.phone')}</dt>
              <dd>{profile.phone || t('profile.noInfo')}</dd>
            </div>
            <div>
              <dt>{t('profile.address')}</dt>
              <dd>{profile.address || t('profile.noInfo')}</dd>
            </div>
          </dl>

          <button type="button" className={styles.logout} onClick={logout}>{t('nav.logout')}</button>
        </aside>

        <section className={styles.content}>
          <div className={styles.stats}>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statOrders')}</span>
              <strong>{stats.orders}</strong>
            </div>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statBooks')}</span>
              <strong>{stats.books}</strong>
            </div>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statSpent')}</span>
              <strong>{money(stats.spent)}</strong>
            </div>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statFavorites')}</span>
              <strong>{favoriteIds.length}</strong>
            </div>
          </div>

          <div className={styles.tabBar} role="tablist" data-reveal>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`${styles.tabBtn} ${tab === key ? styles.tabActive : ''}`}
                onClick={() => selectTab(key)}
              >
                {tabLabels[key]}
              </button>
            ))}
          </div>

          <div className={styles.panel} role="tabpanel" data-reveal>
            {tab === 'info' && (
              <form className={styles.form} onSubmit={handleSave}>
                <h2>{t('profile.formTitle')}</h2>
                <p className={styles.hint}>{t('profile.formHint')}</p>

                <div className={styles.grid}>
                  <label>
                    {t('profile.fullName')}
                    <input name="fullName" value={profile.fullName} onChange={handleChange} placeholder={t('profile.namePlaceholder')} />
                  </label>
                  <label>
                    {t('profile.email')}
                    <input type="email" name="email" value={profile.email} onChange={handleChange} />
                  </label>
                  <label>
                    {t('profile.phone')}
                    <input name="phone" value={profile.phone} onChange={handleChange} />
                  </label>
                  <label>
                    {t('profile.address')}
                    <input name="address" value={profile.address} onChange={handleChange} />
                  </label>
                  <label className={styles.wide}>
                    {t('profile.bio')}
                    <textarea name="bio" rows="4" value={profile.bio} onChange={handleChange} />
                  </label>
                </div>

                <button className={styles.saveBtn} type="submit">
                  {saved ? t('profile.saved') : t('profile.save')}
                </button>
              </form>
            )}

            {tab === 'orders' && (
              <div>
                <h2>{t('profile.historyTitle')}</h2>

                {ordersError && <p className={styles.errorBox}>{t('profile.ordersError')}</p>}

                {!ordersError && orders.length === 0 && (
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
                        <div><dt>{t('cart.delivery')}</dt><dd>{order.delivery_fee > 0 ? money(order.delivery_fee) : t('cart.free')}</dd></div>
                        <div className={styles.grand}><dt>{t('cart.total')}</dt><dd>{money(order.total_price)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {tab === 'favorites' && (
              <div>
                <h2>{t('profile.tabFavorites')}</h2>

                {favoriteBooks.length === 0 ? (
                  <div className={styles.empty}>
                    <p className={styles.emptyIcon} aria-hidden="true">♡</p>
                    <p>{t('profile.noFavorites')}</p>
                    <Link to="/books" className={styles.primaryLink}>{t('profile.toCatalog')}</Link>
                  </div>
                ) : (
                  <div className={styles.shelf}>
                    {favoriteBooks.map((book) => (
                      <div key={book.id} className={styles.shelfItem}>
                        <Link to={`/books/${book.id}`} className={styles.cover}>
                          {book.photo ? <img src={book.photo} alt={book.name} loading="lazy" /> : <span>📗</span>}
                        </Link>
                        <button
                          type="button"
                          className={styles.unfav}
                          aria-label={t('book.removeFavorite')}
                          title={t('book.removeFavorite')}
                          onClick={() => toggleFavorite(book.id)}
                        >
                          ♥
                        </button>
                        <Link to={`/books/${book.id}`} className={styles.shelfTitle}>{book.name}</Link>
                        {book.author_name && <span className={styles.shelfAuthor}>{book.author_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
