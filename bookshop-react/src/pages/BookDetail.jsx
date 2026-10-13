import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { getBook, getBookReviews, getBooks } from '../api'
import BookCard from '../components/BookCard'
import ReviewsPanel from '../components/ReviewsPanel'
import DigitalCopy from '../components/DigitalCopy'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useFavorites } from '../context/FavoritesContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './BookDetail.module.css'

const fallbackImage = '/book-cover-placeholder.svg'

export default function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'reviews' ? 'reviews' : 'description'
  const { addToCart } = useCart()
  const { showToast } = useToast()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { t, locale } = useLang()
  const [book, setBook] = useState(location.state?.book || null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)
  const [similar, setSimilar] = useState([])
  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(!location.state?.book)
  const [error, setError] = useState(false)
  const [imgError, setImgError] = useState(false)
  const sliderRef = useRef(null)

  useEffect(() => {
    if (location.state?.book && String(location.state.book.id) === String(id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBook(location.state.book)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)
    getBook(id)
      .then(res => {
        if (!res.data) {
          setError(true)
          return
        }
        setBook(res.data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, location.state])

  // Yangi kitobga o'tilganda holat boshiga qaytadi
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initialTab)
    setQuantity(1)
    setAdded(false)
    setImgError(false)
    window.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Izohlar soni (reyting belgisi va tab nomi uchun)
  useEffect(() => {
    getBookReviews(id, { page_size: 1 })
      .then((response) => setReviewCount(response.data.count ?? response.data.results?.length ?? 0))
      .catch(() => setReviewCount(0))
  }, [id])

  // "Shu janrdagi kitoblar": o'sha kategoriyadagi boshqa kitoblar
  const categoryId = book?.category
  useEffect(() => {
    if (!categoryId) return
    let active = true
    getBooks({ category: categoryId, page_size: 12 })
      .then((response) => {
        if (!active) return
        const list = response.data.results || []
        setSimilar(list.filter((item) => String(item.id) !== String(id)))
      })
      .catch(() => active && setSimilar([]))
    return () => { active = false }
  }, [categoryId, id])

  if (loading) return <p className="loading">{t('common.loading')}</p>
  if (error || !book) {
    return (
      <main>
        <p className="error">{t('book.loadError')}</p>
        <button className={styles.backBtn} onClick={() => navigate('/books')}>{t('book.backToBooks')}</button>
      </main>
    )
  }

  const favorite = isFavorite(book.id)
  const avg = Number(book.avg_rating || 0)
  const price = book.price ? `${Number(book.price).toLocaleString(locale)} ${t('currency')}` : null
  const languageLabel = book.language ? t(`lang.${book.language}`) : null

  const specs = [
    languageLabel && [t('book.language'), languageLabel],
    book.publisher && [t('book.publisher'), book.publisher],
    book.pages && [t('book.pages'), t('book.pagesValue', { n: book.pages })],
  ].filter(Boolean)

  const details = [
    book.category_name && [t('book.genre'), book.category_name],
    book.author_name && [t('book.author'), book.author_name],
    ...specs,
    book.created_on && [t('book.addedOn'), new Date(book.created_on).toLocaleDateString(locale)],
  ].filter(Boolean)

  const soldOut = book.stock === 0
  const maxQuantity = book.stock ?? 99
  const lowStock = book.stock != null && book.stock > 0 && book.stock <= 5

  const handleAddToCart = () => {
    if (added) {
      navigate('/cart')
      return
    }

    addToCart(book, quantity)
    setAdded(true)
    showToast(t('toast.addedToCart'), { icon: '🛒' })
  }

  const scrollSlider = (direction) => {
    sliderRef.current?.scrollBy({ left: direction * 640, behavior: 'smooth' })
  }

  const tabs = [
    ['description', t('book.tabDescription')],
    ['details', t('book.tabDetails')],
    ['reviews', `${t('book.tabReviews')} (${reviewCount})`],
  ]

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="breadcrumb" data-reveal>
          <Link to="/">{t('nav.home')}</Link>
          <span aria-hidden="true">›</span>
          {book.category_name && (
            <>
              <Link to={`/books?category=${book.category}`}>{book.category_name}</Link>
              <span aria-hidden="true">›</span>
            </>
          )}
          <span className={styles.current}>{book.name}</span>
        </nav>

        <section className={styles.hero} data-reveal>
          <div className={styles.coverCol}>
            <div className={styles.cover}>
              {book.photo && !imgError
                ? <img src={book.photo} alt={book.name} onError={() => setImgError(true)} />
                : <img src={fallbackImage} alt={t('book.noImage')} />}
            </div>
          </div>

          <div className={styles.infoCol}>
            {book.category_name && (
              <Link to={`/books?category=${book.category}`} className={styles.category}>{book.category_name}</Link>
            )}
            <h1 className={styles.title}>{book.name}</h1>
            {book.author_name && <p className={styles.author}>{book.author_name}</p>}

            <div className={styles.ratingRow}>
              <span className={styles.ratingBadge}>
                <strong>{avg.toFixed(1)}</strong>
                <span className={styles.stars} aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= Math.round(avg) ? styles.starOn : styles.starOff}>★</span>
                  ))}
                </span>
                <span className={styles.ratingCount}>({reviewCount})</span>
              </span>
            </div>

            <dl className={styles.specs}>
              {specs.map(([label, value]) => (
                <div key={label} className={styles.specRow}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.buyCard}>
              {price && <p className={styles.price}>{price}</p>}
              {lowStock && <p className={styles.stockNote}>{t('book.stockLeft', { n: book.stock })}</p>}

              <div className={styles.buyRow}>
                <div className={styles.quantityControl} aria-label={t('book.quantity')}>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    aria-label={t('book.decrease')}
                  >−</button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                    aria-label={t('book.increase')}
                  >+</button>
                </div>

                <button
                  type="button"
                  className={`${styles.cartBtn} ${added ? styles.cartBtnAdded : ''}`}
                  onClick={handleAddToCart}
                  disabled={!book.price || soldOut}
                >
                  {soldOut ? t('book.outOfStock') : !book.price ? t('book.noPrice') : added ? t('book.goToCart') : t('book.addToCart')}
                </button>
              </div>

              <DigitalCopy book={book} />
            </div>

            <button
              type="button"
              className={`${styles.favBtn} ${favorite ? styles.favBtnActive : ''}`}
              aria-pressed={favorite}
              onClick={() => toggleFavorite(book.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.6 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3c1.4-1.9 3.1-3 5.1-3c3.3 0 5.3 3.2 4.1 6.6c-1.7 4.8-9.2 9.4-9.2 9.4Z" />
              </svg>
              {favorite ? t('book.inFavorite') : t('book.favorite')}
            </button>
          </div>
        </section>

        <section className={styles.tabsSection} data-reveal>
          <div className={styles.tabBar} role="tablist">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`${styles.tabBtn} ${tab === key ? styles.tabActive : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.tabPanel} role="tabpanel">
            {tab === 'description' && (
              <>
                <h2 className={styles.panelTitle}>{t('book.aboutBook')}</h2>
                <p className={styles.about}>{book.about || t('book.noDescription')}</p>
              </>
            )}

            {tab === 'details' && (
              <>
                <h2 className={styles.panelTitle}>{t('book.detailsTitle')}</h2>
                <p className={styles.panelSubtitle}>{t('book.detailsSubtitle')}</p>
                <dl className={styles.infoGrid}>
                  {details.map(([label, value]) => (
                    <div key={label} className={styles.infoCard}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {tab === 'reviews' && <ReviewsPanel bookId={id} onCountChange={setReviewCount} />}
          </div>
        </section>

        {similar.length > 0 && (
          <section className={styles.similar} data-reveal>
            <div className={styles.similarHead}>
              <h2>{t('book.similar')}</h2>
              <div className={styles.arrows}>
                <button type="button" aria-label={t('book.previous')} onClick={() => scrollSlider(-1)}>‹</button>
                <button type="button" aria-label={t('book.next')} onClick={() => scrollSlider(1)}>›</button>
              </div>
            </div>
            <div className={styles.slider} ref={sliderRef}>
              {similar.map((item) => (
                <div key={item.id} className={styles.sliderItem}>
                  <BookCard book={item} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
