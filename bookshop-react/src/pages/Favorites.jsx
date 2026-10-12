import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getBooks } from '../api'
import { useFavorites } from '../context/FavoritesContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './Profile.module.css'

// Sevimli kitoblar: foydalanuvchi yurakcha bilan belgilagan kitoblar
export default function Favorites() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  const isLoggedIn = Boolean(localStorage.getItem('access_token'))

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/favorites' } })
      return
    }

    getBooks({ page_size: 100 })
      .then((response) => setBooks(response.data.results || []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false))
  }, [isLoggedIn, navigate])

  const favoriteBooks = useMemo(
    () => favoriteIds.map((id) => books.find((book) => book.id === id)).filter(Boolean),
    [books, favoriteIds]
  )

  return (
    <main className={styles.page}>
      <div className={styles.single}>
        <div className={styles.panel} data-reveal>
          <h2>{t('profile.tabFavorites')}</h2>

          {!loading && favoriteBooks.length === 0 ? (
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
      </div>
    </main>
  )
}
