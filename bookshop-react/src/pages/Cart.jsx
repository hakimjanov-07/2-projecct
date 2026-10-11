import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkoutOrder, getCartQuote } from '../api'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './Cart.module.css'

const fallbackImage = '/book-cover-placeholder.svg'

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2M9 13a3 3 0 0 0 6 0" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  )
}

function PercentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.9-2.6-2.2-1.6.8-2.6-.8-2.6 2.2-1.6.9-2.6 2.7.1L12 3Z" />
      <path d="M9.5 14.5l5-5M9.7 9.7h.01M14.3 14.3h.01" />
    </svg>
  )
}

export default function Cart() {
  const { items, totalItems, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t, locale } = useLang()
  const [submitting, setSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [quote, setQuote] = useState(null)

  // Chegirma, yetkazib berish va to'lov summasi serverdan olinadi (buyurtmadagi hisob bilan bir xil)
  useEffect(() => {
    if (items.length === 0) return
    let active = true
    const timer = setTimeout(() => {
      getCartQuote(items, promoCode)
        .then((response) => active && setQuote(response.data))
        .catch(() => active && setQuote(null))
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [items, promoCode])

  const activeQuote = items.length > 0 ? quote : null
  const subtotal = activeQuote?.subtotal ?? totalPrice
  const discount = activeQuote?.discount ?? 0
  const deliveryFee = activeQuote?.delivery_fee ?? 0
  const payTotal = activeQuote?.total ?? totalPrice
  const promoApplied = activeQuote?.promo || null
  const promoInvalid = Boolean(promoCode) && activeQuote !== null && activeQuote.promo_valid === false

  const applyPromo = (event) => {
    event.preventDefault()
    setPromoCode(promoInput.trim())
  }

  const clearPromo = () => {
    setPromoInput('')
    setPromoCode('')
  }

  const money = (value) => `${Number(value).toLocaleString(locale)} ${t('currency')}`

  const placeOrder = async () => {
    setOrderError('')

    if (!localStorage.getItem('access_token')) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }

    setSubmitting(true)
    try {
      await checkoutOrder(items, promoApplied ? promoApplied.code : '')
      clearCart()
      clearPromo()
      setOrderPlaced(true)
      showToast(t('toast.orderPlaced'))
    } catch (error) {
      setOrderError(
        error.response?.status === 401
          ? t('cart.sessionExpired')
          : error.response?.data?.error || error.response?.data?.promo_code || t('cart.orderFailed')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header} data-reveal>
          <div>
            <h1>{t('cart.selected')}</h1>
            <p>{t('cart.subtitle')}</p>
          </div>
          <div className={styles.countPill}>
            <BagIcon /> {t('cart.itemsCount', { n: totalItems })}
          </div>
        </header>

        {orderPlaced && (
          <div className={styles.success} role="status">
            <strong>{t('cart.placed')}</strong>
            <span>{t('cart.placedHint')}</span>
          </div>
        )}

        <div className={styles.layout}>
          <section className={styles.list}>
            <div className={styles.actions} data-reveal>
              <Link to="/books" className={styles.continueBtn}>
                <span aria-hidden="true">‹</span> {t('cart.continue')}
              </Link>
              {items.length > 0 && (
                <button type="button" className={styles.clearBtn} onClick={clearCart}>
                  <TrashIcon /> {t('cart.clearAll')}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className={styles.empty} data-reveal>
                <div className={styles.emptyIcon} aria-hidden="true">🛒</div>
                <h2>{t('cart.empty')}</h2>
                <p>{t('cart.emptyHint2')}</p>
              </div>
            ) : (
              items.map((item) => (
                <article key={item.id} className={styles.item} data-reveal>
                  <Link to={`/books/${item.id}`} className={styles.cover}>
                    <img src={item.photo || fallbackImage} alt={item.name} />
                  </Link>

                  <div className={styles.body}>
                    <div className={styles.top}>
                      <div className={styles.titleBox}>
                        {item.category_name && <p className={styles.category}>{item.category_name}</p>}
                        <h2><Link to={`/books/${item.id}`}>{item.name}</Link></h2>
                      </div>
                      <div className={styles.priceBox}>
                        <p>{money(item.price * item.quantity)}</p>
                        {item.quantity > 1 && <span>{money(item.price)} × {item.quantity}</span>}
                      </div>
                    </div>

                    <div className={styles.bottom}>
                      <div className={styles.qty}>
                        <button
                          type="button"
                          aria-label={t('cart.decrease')}
                          onClick={() => updateQuantity(item.id, -1)}
                        >−</button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          type="button"
                          className={styles.qtyPlus}
                          aria-label={t('cart.increase')}
                          onClick={() => updateQuantity(item.id, 1)}
                        >+</button>
                      </div>

                      <button type="button" className={styles.removeBtn} onClick={() => removeFromCart(item.id)}>
                        <TrashIcon /> {t('cart.remove')}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className={styles.summary} data-reveal>
            <h2>{t('cart.summaryTitle')}</h2>

            <div className={styles.rows}>
              <div className={styles.row}>
                <span>{t('cart.products')}</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div className={styles.row}>
                <span>{t('cart.discount')}</span>
                <strong className={styles.green}>{discount > 0 ? '−' : ''}{money(discount)}</strong>
              </div>
              <div className={styles.row}>
                <span>{t('cart.delivery')}</span>
                <strong>{deliveryFee > 0 ? money(deliveryFee) : t('cart.free')}</strong>
              </div>
            </div>

            <div className={styles.totalRow}>
              <div>
                <p>{t('cart.payTotal')}</p>
                <strong>{money(payTotal)}</strong>
              </div>
              <span className={styles.badge}>{t('cart.itemsCount', { n: totalItems })}</span>
            </div>

            <form className={styles.promoBox} onSubmit={applyPromo}>
              <label htmlFor="promo-code" className={styles.promoLabel}>
                <PercentIcon /> {t('cart.promo')}
              </label>
              <div className={styles.promoRow}>
                <input
                  id="promo-code"
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  placeholder={t('cart.promoPlaceholder')}
                  autoComplete="off"
                />
                <button type="submit" disabled={items.length === 0}>{t('cart.apply')}</button>
              </div>
              {promoApplied && (
                <p className={styles.promoOk}>
                  {t('cart.promoApplied', { code: promoApplied.code, percent: promoApplied.percent })}
                  <button type="button" onClick={clearPromo}>{t('cart.promoClear')}</button>
                </p>
              )}
              {promoInvalid && <p className={styles.promoBad}>{t('cart.promoInvalid')}</p>}
            </form>

            {orderError && <p className={styles.error} role="alert">{orderError}</p>}

            <button
              type="button"
              className={styles.checkoutBtn}
              onClick={placeOrder}
              disabled={submitting || items.length === 0}
            >
              <CardIcon /> {submitting ? t('cart.ordering') : t('cart.checkout')}
            </button>
          </aside>
        </div>
      </div>
    </main>
  )
}
