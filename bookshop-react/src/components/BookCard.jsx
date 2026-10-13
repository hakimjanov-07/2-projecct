import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './BookCard.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

function getImgUrl(photo) {
  if (!photo) return null
  if (photo.startsWith('http')) return photo
  return BASE + photo
}

export default function BookCard({ book }) {
  const { locale, t } = useLang()
  const { isFavorite, toggleFavorite } = useFavorites()
  const favorite = isFavorite(book.id)
  const navigate = useNavigate()
  const ratingData = { avg: Number(book.avg_rating || 0), count: book.reviews_count || 0 }
  const imgUrl = getImgUrl(book.photo)

  const handleOpenDetails = (e) => {
    e.stopPropagation()
    navigate(`/books/${book.id}`, { state: { book } })
  }

  const stars = Array.from({ length: 5 }, (_, index) => index < Math.round(ratingData.avg))

  return (
    <div className={styles.card} data-reveal onClick={() => navigate(`/books/${book.id}`)}>
      <div className={styles.img}>
        {book.stock === 0 && <span className={styles.soldOut}>{t('book.outOfStock')}</span>}
        {imgUrl
          ? <img src={imgUrl} alt={book.name} loading="lazy"
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
          : null}
        <div className={styles.placeholder} style={{ display: imgUrl ? 'none' : 'flex' }} />
      </div>
      <div className={styles.body}>
        {book.category_name && <p className={styles.category}>{book.category_name}</p>}
        <div className={styles.titleRow}>
          <p className={styles.title}>{book.name}</p>
          <button
            type="button"
            className={`${styles.heart} ${favorite ? styles.heartActive : ''}`}
            aria-pressed={favorite}
            aria-label={favorite ? t('book.removeFavorite') : t('book.addFavorite')}
            title={favorite ? t('book.removeFavorite') : t('book.addFavorite')}
            onClick={(event) => {
              event.stopPropagation()
              toggleFavorite(book.id)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.6 4.5 6.9 4.5c2 0 3.7 1.1 5.1 3c1.4-1.9 3.1-3 5.1-3c3.3 0 5.3 3.2 4.1 6.6c-1.7 4.8-9.2 9.4-9.2 9.4Z" />
            </svg>
          </button>
        </div>
        <p className={styles.author}>{book.author_name || ''}</p>

        <div className={styles.ratingRow}>
          <span className={styles.stars} aria-label={`${ratingData.avg.toFixed(1)} / 5`}>
            {stars.map((filled, index) => (
              <span
                key={index}
                className={filled ? styles.starFilled : styles.starEmpty}
                aria-hidden="true"
              >
                ★
              </span>
            ))}
          </span>
          <span className={styles.ratingScore}>{ratingData.count ? ratingData.avg.toFixed(1) : '0.0'}</span>
          <span className={styles.reviewCount}>({ratingData.count})</span>
        </div>

        <div className={styles.footer}>
          {book.price
            ? <p className={styles.price}>{Number(book.price).toLocaleString(locale)} {t('currency')}</p>
            : <span />}
          <button className={styles.addBtn} onClick={handleOpenDetails} disabled={book.stock === 0}>
            🛒 +
          </button>
        </div>
      </div>
    </div>
  )
}
