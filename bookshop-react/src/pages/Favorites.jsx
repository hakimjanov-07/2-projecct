import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllBooks } from '../api'
import ErrorMessage from '../components/ErrorMessage'
import { useFavorites } from '../context/FavoritesContext'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Static.module.css'

// Sevimli kitoblar: maqolalar sahifasi uslubida (bosh qism + rasmli kartalar)
export default function Favorites() {
  const { t, locale } = useLang()
  useDocumentTitle(t('title.favorites'))
  const navigate = useNavigate()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isLoggedIn = Boolean(localStorage.getItem('access_token'))

  const loadBooks = useCallback(() => {
    getAllBooks()
      .then((response) => setBooks(response.data.results || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const retry = () => {
    setError(false)
    setLoading(true)
    loadBooks()
  }

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/favorites' } })
      return
    }

    loadBooks()
  }, [isLoggedIn, navigate, loadBooks])

  const favoriteBooks = useMemo(
    () => favoriteIds.map((id) => books.find((book) => book.id === id)).filter(Boolean),
    [books, favoriteIds]
  )

  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.helpHero} ${styles.favoritesHero}`}>
        <p className={styles.eyebrow}>{t('profile.tabFavorites')}</p>
        <h1>{t('favorites.title')}</h1>
        <p>{t('favorites.lead')}</p>
      </div>

      <div className={styles.content}>
        {error && favoriteIds.length > 0 ? (
          // Tarmoq xatosi "sevimlilar yo'q" deb ko'rinmasin
          <ErrorMessage message={t('favorites.loadError')} onRetry={retry} />
        ) : !loading && favoriteBooks.length === 0 ? (
          <div className={styles.favEmpty}>
            <p aria-hidden="true">♡</p>
            <p>{t('profile.noFavorites')}</p>
            <Link to="/books" className={styles.favEmptyLink}>{t('profile.toCatalog')}</Link>
          </div>
        ) : (
          <div className={styles.favGrid}>
            {favoriteBooks.map((book) => (
              <div
                key={book.id}
                className={`${styles.articleCard} ${styles.favCard}`}
                data-reveal
                onClick={() => navigate(`/books/${book.id}`)}
              >
                <div className={styles.articleImg}>
                  {book.photo ? <img src={book.photo} alt={book.name} loading="lazy" /> : null}
                </div>
                <button
                  type="button"
                  className={styles.favRemove}
                  aria-label={t('book.removeFavorite')}
                  title={t('book.removeFavorite')}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleFavorite(book.id)
                  }}
                >
                  ♥
                </button>
                <div className={styles.articleBody}>
                  <p className={styles.articleTitle}>{book.name}</p>
                  {book.author_name && <p className={styles.articleExcerpt}>{book.author_name}</p>}
                  {book.price ? (
                    <p className={styles.favPrice}>{Number(book.price).toLocaleString(locale)} {t('currency')}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
