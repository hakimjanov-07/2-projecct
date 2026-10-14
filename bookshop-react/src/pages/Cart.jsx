import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkoutOrder, getCartQuote, getProfile } from '../api'
import { EMPTY_FORM, formatPhone, loadSavedForm, saveForm } from '../components/deliveryForm'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './Cart.module.css'

const fallbackImage = '/book-cover-placeholder.svg'

// Xarita (Leaflet) faqat oyna ochilganda yuklanadi
const PickupModal = lazy(() => import('../components/PickupModal'))
const DeliveryModal = lazy(() => import('../components/DeliveryModal'))

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

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M10 20v-5h4v5" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
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
  // Qabul qilish usuli: null - hali tanlanmagan; oyna faqat tasdiqlanganda usulni o'zgartiradi
  const [method, setMethod] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...loadSavedForm() }))

  // Bo'sh maydonlarni profil ma'lumoti bilan to'ldirish (kirgan foydalanuvchi uchun)
  useEffect(() => {
    if (!localStorage.getItem('access_token')) return
    let active = true
    getProfile()
      .then(({ data }) => {
        if (!active) return
        setForm((prev) => ({
          ...prev,
          recipient_name: prev.recipient_name || data.full_name || '',
          recipient_phone: prev.recipient_phone || formatPhone(data.phone || ''),
          street: prev.street || data.address || '',
        }))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Chegirma, yetkazib berish va to'lov summasi serverdan olinadi (buyurtmadagi hisob bilan bir xil)
  useEffect(() => {
    if (items.length === 0) return
    let active = true
    const timer = setTimeout(() => {
      getCartQuote(items, promoCode, method === 'pickup' ? 'pickup' : 'delivery')
        .then((response) => active && setQuote(response.data))
        .catch(() => active && setQuote(null))
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [items, promoCode, method])

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

  const confirmPickup = (contact) => {
    setForm((prev) => ({ ...prev, ...contact }))
    setMethod('pickup')
    setModal(null)
    setOrderError('')
  }

  const confirmDelivery = (values) => {
    setForm(values)
    setMethod('delivery')
    setModal(null)
    setOrderError('')
  }

  const money = (value) => `${Number(value).toLocaleString(locale)} ${t('currency')}`

  const placeOrder = async () => {
    setOrderError('')

    if (!localStorage.getItem('access_token')) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }

    if (!method) {
      setOrderError(t('cart.chooseMethod'))
      return
    }

    setSubmitting(true)
    try {
      const delivery = method === 'pickup'
        ? { delivery_method: 'pickup', recipient_name: form.recipient_name, recipient_phone: form.recipient_phone }
        : { delivery_method: 'delivery', ...form }
      await checkoutOrder(items, promoApplied ? promoApplied.code : '', delivery)
      saveForm(form)
      clearCart()
      clearPromo()
      setOrderPlaced(true)
      showToast(t('toast.orderPlaced'))
    } catch (error) {
      const data = error.response?.data
      const addressInvalid = error.response?.status === 400
        && ['recipient_name', 'recipient_phone', 'city', 'street'].some((key) => key in (data || {}))
      if (addressInvalid) setModal('delivery')
      const shortages = error.response?.status === 409 && Array.isArray(data?.items)
        ? data.items.map((item) => item.name + ': ' + item.available + ' ' + t('cart.stockAvailable')).join(', ')
        : ''
      setOrderError(
        error.response?.status === 401
          ? t('cart.sessionExpired')
          : addressInvalid
            ? t('cart.deliveryInvalid')
            : shortages
            ? t('cart.stockError') + ' (' + shortages + ')'
            : data?.error || data?.promo_code || t('cart.orderFailed')
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

            <div className={styles.methodBox}>
              <div className={styles.methodToggle} data-method={method || undefined} role="group" aria-label={t('cart.method')}>
                <button
                  type="button"
                  className={method === 'pickup' ? styles.methodOn : ''}
                  aria-pressed={method === 'pickup'}
                  onClick={() => setModal('pickup')}
                >
                  <StoreIcon /> {t('cart.pickup')}
                </button>
                <button
                  type="button"
                  className={method === 'delivery' ? styles.methodOn : ''}
                  aria-pressed={method === 'delivery'}
                  onClick={() => setModal('delivery')}
                >
                  <TruckIcon /> {t('cart.delivery')}
                </button>
              </div>
              {method === 'pickup' && <p className={styles.methodInfo}>{t('cart.pickupFrom')}</p>}
              {method === 'delivery' && (
                <p className={styles.methodInfo}>
                  {form.recipient_name}, {form.recipient_phone}
                  <br />
                  {[form.city, form.district, form.street, form.house].filter(Boolean).join(', ')}
                </p>
              )}
              {!method && <p className={styles.methodHint}>{t('cart.chooseMethod')}</p>}
            </div>

            <div className={styles.rows}>
              <div className={styles.row}>
                <span>{t('cart.products')}</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div className={styles.row}>
                <span>{t('cart.discount')}</span>
                <strong className={styles.green}>{discount > 0 ? '−' : ''}{money(discount)}</strong>
              </div>
              {method === 'delivery' && (
                <div className={`${styles.row} ${styles.flash}`}>
                  <span>{t('cart.delivery')}</span>
                  <strong key={deliveryFee}>{deliveryFee > 0 ? money(deliveryFee) : t('cart.free')}</strong>
                </div>
              )}
            </div>

            <div className={styles.totalRow}>
              <div>
                <p>{t('cart.payTotal')}</p>
                <strong key={payTotal} className={styles.flash}>{money(payTotal)}</strong>
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
              disabled={submitting || items.length === 0 || !method}
            >
              <CardIcon /> {submitting ? t('cart.ordering') : t('cart.checkout')}
            </button>
          </aside>
        </div>
      </div>

      <Suspense fallback={null}>
        {modal === 'pickup' && <PickupModal initial={form} onConfirm={confirmPickup} onClose={() => setModal(null)} />}
        {modal === 'delivery' && <DeliveryModal initial={form} onConfirm={confirmDelivery} onClose={() => setModal(null)} />}
      </Suspense>
    </main>
  )
}
