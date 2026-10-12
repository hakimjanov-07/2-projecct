import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBooks } from '../api'
import BookCard from '../components/BookCard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { useFavorites } from '../context/FavoritesContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './MyBooks.module.css'

export default function MyBooks() {
  const { t } = useLang()
  const { favoriteIds } = useFavorites()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getBooks({ page_size: 100 })
      .then((response) => setBooks(response.data.results || []))
      .catch(() => setError(t('books.loadError')))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(load, [])

  // Yangi qo'shilgan sevimli kitob ro'yxat boshida turadi
  const favoriteBooks = useMemo(
    () => favoriteIds.map((id) => books.find((book) => book.id === id)).filter(Boolean),
    [books, favoriteIds]
  )

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.header} data-reveal>
          <div>
            <h1>{t('myBooks.title')}</h1>
            <p className={styles.sub}>{t('myBooks.subtitle')}</p>
          </div>
          <Link to="/books" className={styles.catalogBtn}>{t('myBooks.toCatalog')}</Link>
        </header>

        <div className={styles.stat} data-reveal>
          <span>{t('myBooks.countLabel')}</span>
          <strong>{favoriteIds.length}</strong>
        </div>

        {loading && <LoadingSpinner />}
        {!loading && error && <ErrorMessage message={error} onRetry={load} />}

        {!loading && !error && favoriteBooks.length === 0 && (
          <div className={styles.empty} data-reveal>
            <p className={styles.emptyIcon}>♡</p>
            <h2>{t('myBooks.empty')}</h2>
            <p>{t('myBooks.emptyHint')}</p>
          </div>
        )}

        {!loading && !error && favoriteBooks.length > 0 && (
          <div className={styles.grid}>
            {favoriteBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
