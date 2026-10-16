import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkoutOrder, getCartQuote, getProfile } from '../api'
import { EMPTY_FORM, formatPhone, loadSavedForm, saveForm } from '../components/deliveryForm'
import Modal from '../components/Modal'
import ModalBoundary from '../components/ModalBoundary'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Cart.module.css'

const fallbackImage = '/book-cover-placeholder.svg'

// Xarita (Leaflet) faqat oyna ochilganda yuklanadi
const PickupModal = lazy(() => import('../components/PickupModal'))
const DeliveryModal = lazy(() => import('../components/DeliveryModal'))

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* Qopqoq va tana alohida: hover'da qopqoq ko'tariladi, tana tebranadi */}
      <path className={styles.trashBody} d="M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path className={styles.trashLid} d="M4 7h16M9 7V4h6v3" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2" />
      {/* Tabassum alohida path: hover'da kengayib ko'tariladi */}
      <path className={styles.bagSmile} d="M9 13a3 3 0 0 0 6 0" />
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

// Qator so'nib yig'ilish vaqti (ms); shundan keyin qator savatdan olib tashlanadi
const REMOVE_MS = 400
const COLLAPSE_MS = 380
const STAGGER_MS = 50

// Qator balandligi (va tepa oraliq) silliq 0 ga yig'iladi, pastdagi qatorlar sakramasdan ko'tariladi
const collapseRow = (row, delay) => {
  if (!row || row.dataset.leaving) return
  row.dataset.leaving = '1'
  const cs = getComputedStyle(row)
  row.style.overflow = 'hidden'
  row.animate(
    [
      {
        height: `${row.offsetHeight}px`, marginTop: cs.marginTop, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
        borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, opacity: 1, transform: 'translateX(0)',
      },
      {
        height: '0px', marginTop: '0px', paddingTop: '0px', paddingBottom: '0px',
        borderTopWidth: '0px', borderBottomWidth: '0px', opacity: 0, transform: 'translateX(-12px)',
      },
    ],
    { duration: COLLAPSE_MS, delay, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' }
  )
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Tugmadagi ikonka yozuv ichiga qancha siljishini o'lchaydi (CSS o'zgaruvchisi --slide)
const setSlide = (button) => {
  const label = button.querySelector('[data-label]')
  if (label) button.style.setProperty('--slide', `${Math.round(label.offsetWidth / 2 + 24)}px`)
}

// Savatdagi miqdor ombordagi sondan oshmasligi uchun "+" shu chegarada o'chadi (stock noma'lum bo'lsa cheklanmagan)
const atLimit = (item) => typeof item.stock === 'number' && item.quantity >= item.stock

export default function Cart() {
  const { items, totalItems, totalPrice, updateQuantity, removeFromCart, clearCart, syncItems } = useCart()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t, locale } = useLang()
  useDocumentTitle(t('title.cart'))
  const [submitting, setSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteFailed, setQuoteFailed] = useState(false)
  const [quoteTry, setQuoteTry] = useState(0) // "Qo'llash" qayta bosilganda (kod o'sha-o'sha bo'lsa ham) hisob-kitob qayta so'raladi
  // Qabul qilish usuli: null - hali tanlanmagan; oyna faqat tasdiqlanganda usulni o'zgartiradi
  const [method, setMethod] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...loadSavedForm() }))
  // O'chirilayotgan qatorlar (animatsiya vaqtida) va "hammasini tozalash" holati
  const [leavingIds, setLeavingIds] = useState([])
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const clearBtnRef = useRef(null)
  const timers = useRef([])
  const orderKey = useRef({ sig: '', key: '' }) // Idempotency-Key: bir xil savat/usul/manzil uchun qayta bosishda o'sha kalit
  const headingRef = useRef(null)

  useEffect(() => {
    const list = timers.current
    return () => list.forEach(clearTimeout)
  }, [])

  // Fokus yo'qolayotgan qatorda qolib ketmasin: keyingi (yoki oldingi) qator tugmasiga, bo'lmasa sarlavhaga
  const moveFocus = (row) => {
    const active = document.activeElement
    if (active && active !== document.body && !row?.contains(active)) return
    let target = null
    for (let el = row?.nextElementSibling; el && !target; el = el.nextElementSibling) {
      if (!el.dataset.leaving) target = el.querySelector('[data-remove]')
    }
    for (let el = row?.previousElementSibling; el && !target; el = el.previousElementSibling) {
      if (!el.dataset.leaving) target = el.querySelector('[data-remove]')
    }
    ;(target || headingRef.current)?.focus({ preventScroll: true })
  }

  const handleRemove = (event, id) => {
    if (leavingIds.includes(id) || clearing) return
    const row = event.currentTarget.closest('article')
    if (prefersReducedMotion()) {
      moveFocus(row)
      removeFromCart(id)
      return
    }
    setSlide(event.currentTarget)
    setLeavingIds((ids) => [...ids, id])
    collapseRow(row, 0)
    timers.current.push(setTimeout(() => {
      moveFocus(row)
      removeFromCart(id)
      setLeavingIds((ids) => ids.filter((x) => x !== id))
    }, REMOVE_MS))
  }

  // 2 ta va undan ko'p kitob bo'lsa avval tasdiq so'raladi, 1 tasi bo'lsa darhol tozalanadi
  const handleClear = () => {
    if (clearing) return
    if (items.length >= 2) {
      setConfirmClear(true)
      return
    }
    runClear()
  }

  const runClear = () => {
    if (clearing) return
    if (prefersReducedMotion()) {
      headingRef.current?.focus({ preventScroll: true })
      clearCart()
      return
    }
    if (clearBtnRef.current) setSlide(clearBtnRef.current)
    setClearing(true)
    // Qatorlar yengil stagger bilan so'nib yig'iladi
    const rows = [...document.querySelectorAll('[data-cart-row]')].filter((row) => !row.dataset.leaving)
    rows.forEach((row, index) => collapseRow(row, index * STAGGER_MS))
    timers.current.push(setTimeout(() => {
      headingRef.current?.focus({ preventScroll: true })
      clearCart()
      setClearing(false)
    }, REMOVE_MS + Math.max(0, rows.length - 1) * STAGGER_MS))
  }

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

  // Qatorlar, chegirma, yetkazib berish va to'lov summasi bitta manbadan (server quote) olinadi.
  // Usul tanlanmaguncha yetkazib berish puli hisoblanmaydi ('pickup' so'raladi).
  const quoteMethod = method === 'delivery' ? 'delivery' : 'pickup'
  useEffect(() => {
    if (items.length === 0) return
    let active = true
    const timer = setTimeout(() => {
      getCartQuote(items, promoCode, quoteMethod)
        .then((response) => {
          if (!active) return
          const data = response.data
          setQuote({ ...data, method: quoteMethod })
          setQuoteFailed(false)
          // Savatdagi eski nom/narx/rasmni joriy ma'lumot bilan almashtirish, yo'q kitobni olib tashlash
          const lines = data.items || []
          const lineIds = new Set(lines.map((line) => line.id))
          const dropped = items.some((item) => !lineIds.has(item.id) || lines.find((line) => line.id === item.id).stock === 0)
          syncItems(lines, data.missing || [])
          if (dropped) showToast(t('cart.removedUnavailable'), { type: 'error', icon: '!' })
        })
        .catch(() => {
          if (!active) return
          setQuote(null)
          setQuoteFailed(true)
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, promoCode, quoteMethod, quoteTry])

  // Server javobi savatdagi joriy qatorlarga aynan mos bo'lsagina ishlatiladi, aks holda qatorlar yig'indisi
  const quoteFits = items.length > 0 && quote !== null && quote.method === quoteMethod
    && quote.items.length === items.length
    && items.every((item) => quote.items.some((line) => line.id === item.id && Number(line.price) === item.price && line.quantity === item.quantity))
  const activeQuote = quoteFits ? quote : null
  const subtotal = totalPrice
  const discount = activeQuote?.discount ?? 0
  const deliveryFee = method === 'delivery' ? activeQuote?.delivery_fee ?? 0 : 0
  const payTotal = subtotal - discount + deliveryFee
  const promoApplied = (items.length > 0 ? quote?.promo : null) || null
  const promoInvalid = Boolean(promoCode) && items.length > 0 && quote !== null && quote.promo_valid === false

  const applyPromo = (event) => {
    event.preventDefault()
    setPromoCode(promoInput.trim())
    setQuoteTry((n) => n + 1)
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
      const promo = promoApplied ? promoApplied.code : ''
      const sig = JSON.stringify([items.map((i) => [i.id, i.quantity]), promo, delivery])
      if (orderKey.current.sig !== sig) orderKey.current = { sig, key: crypto.randomUUID() }
      const { data: order } = await checkoutOrder(items, promo, delivery, { idempotencyKey: orderKey.current.key })
      orderKey.current = { sig: '', key: '' }
      saveForm(form)
      clearCart()
      clearPromo()
      setOrderPlaced(true)
      // Tepadan tushuvchi xabar: buyurtma raqami va "Buyurtmalarimga o'tish" havolasi bilan
      showToast(order?.id ? t('toast.orderAcceptedNo', { n: order.id }) : t('toast.orderAccepted'), {
        drop: true,
        duration: 4000,
        action: { label: t('toast.goOrders'), onClick: () => navigate('/orders') },
      })
    } catch (error) {
      const data = error.response?.data
      const addressInvalid = error.response?.status === 400
        && ['recipient_name', 'recipient_phone', 'city', 'street'].some((key) => key in (data || {}))
      if (addressInvalid) setModal('delivery')
      const shortages = error.response?.status === 409 && Array.isArray(data?.items)
        ? data.items.map((item) => item.name + ': ' + item.available + ' ' + t('cart.stockAvailable')).join(', ')
        : ''
      setOrderError(
        error.response?.status === 429
          ? t('auth.tooManyAttempts')
          : error.response?.status === 401
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
            <h1 ref={headingRef} tabIndex={-1}>{t('cart.selected')}</h1>
            <p>{t('cart.subtitle')}</p>
          </div>
          <div className={styles.countPill}>
            {/* key: son o'zgarganda animatsiya qayta ishga tushadi */}
            <span key={totalItems} className={styles.bagWrap}><BagIcon /></span>
            <span key={`n${totalItems}`} className={styles.countText}>{t('cart.itemsCount', { n: totalItems })}</span>
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
                <button
                  type="button"
                  className={`${styles.clearBtn} ${clearing ? styles.removing : ''}`}
                  ref={clearBtnRef}
                  onClick={handleClear}
                  disabled={clearing}
                >
                  <TrashIcon /> <span data-label className={styles.btnLabel}>{t('cart.clearAll')}</span>
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
                <article
                  key={item.id}
                  className={styles.item}
                  data-cart-row
                  data-reveal
                >
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
                      <div className={styles.qtyWrap}>
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
                            aria-describedby={atLimit(item) ? `stock-${item.id}` : undefined}
                            disabled={atLimit(item)}
                            onClick={() => updateQuantity(item.id, 1)}
                          >+</button>
                        </div>
                        {atLimit(item) && (
                          <p id={`stock-${item.id}`} className={styles.stockHint}>{t('cart.stockLimit', { n: item.stock })}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        className={`${styles.removeBtn} ${leavingIds.includes(item.id) ? styles.removing : ''}`}
                        onClick={(event) => handleRemove(event, item.id)}
                        data-remove
                        disabled={leavingIds.includes(item.id) || clearing}
                      >
                        <TrashIcon /> <span data-label className={styles.btnLabel}>{t('cart.remove')}</span>
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
              {/* Server hisob-kitobi yiqilsa promo kod jim yo'qolmasin */}
              {Boolean(promoCode) && items.length > 0 && quoteFailed && (
                <p className={styles.promoBad} role="alert">{t('cart.quoteError')}</p>
              )}
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

      {confirmClear && items.length > 0 && (
        <Modal title={t('cart.clearConfirmTitle')} onClose={() => setConfirmClear(false)}>
          <p className={styles.confirmText}>{t('cart.clearConfirmText', { n: items.length })}</p>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.confirmCancel} data-autofocus onClick={() => setConfirmClear(false)}>
              {t('modal.cancel')}
            </button>
            <button
              type="button"
              className={styles.confirmYes}
              onClick={() => {
                setConfirmClear(false)
                runClear()
              }}
            >
              {t('cart.clearYes')}
            </button>
          </div>
        </Modal>
      )}

      <ModalBoundary
        resetKey={modal}
        onError={() => {
          setModal(null)
          showToast(t('cart.modalLoadFailed'), { type: 'error', icon: '!' })
        }}
      >
        <Suspense fallback={null}>
          {modal === 'pickup' && <PickupModal initial={form} onConfirm={confirmPickup} onClose={() => setModal(null)} />}
          {modal === 'delivery' && <DeliveryModal initial={form} onConfirm={confirmDelivery} onClose={() => setModal(null)} />}
        </Suspense>
      </ModalBoundary>
    </main>
  )
}
