import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAuthors, getBooks } from '../api'
import { useLang } from '../i18n/LanguageContext'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import styles from './Authors.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

const getImgUrl = (photo) => {
  if (!photo) return null
  return photo.startsWith('http') ? photo : BASE + photo
}

export default function Authors() {
  const { t, locale } = useLang()
  const [authors, setAuthors] = useState([])
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([getAuthors(), getBooks({ page_size: 100 })])
      .then(([authorsResult, booksResult]) => {
        if (authorsResult.status === 'fulfilled') {
          setAuthors(authorsResult.value.data.results || [])
        } else {
          setError(t('authors.loadError'))
        }
        if (booksResult.status === 'fulfilled') setBooks(booksResult.value.data.results || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const bookCounts = useMemo(() => {
    const counts = new Map()
    books.forEach((book) => counts.set(book.author, (counts.get(book.author) || 0) + 1))
    return counts
  }, [books])

  const selectedAuthor = authors.find((author) => author.id === selectedId) || null
  const selectedBooks = useMemo(
    () => books.filter((book) => book.author === selectedId),
    [books, selectedId]
  )

  // Modal ochiq paytida Escape bilan yopiladi va sahifa aylanmaydi
  useEffect(() => {
    if (!selectedAuthor) return
    const handleKey = (event) => {
      if (event.key === 'Escape') setSelectedId(null)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [selectedAuthor])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? authors.filter((author) => author.full_name.toLowerCase().includes(q)) : authors
  }, [authors, search])

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.header} data-reveal>
          <div>
            <p className={styles.eyebrow}>{t('authors.eyebrow')}</p>
            <h1>{t('authors.title')}</h1>
            <p className={styles.sub}>{t('authors.count', { n: authors.length })}</p>
          </div>
          <input
            className={styles.search}
            type="search"
            placeholder={t('authors.search')}
            aria-label={t('authors.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </header>

        {loading && <LoadingSpinner />}
        {!loading && error && <ErrorMessage message={error} onRetry={load} />}
        {!loading && !error && filtered.length === 0 && (
          <p className={styles.empty}>{t('authors.notFound')}</p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className={styles.grid}>
            {filtered.map((author) => {
              const img = getImgUrl(author.photo)
              const count = bookCounts.get(author.id) || 0
              return (
                <article
                  key={author.id}
                  className={styles.card}
                  data-reveal
                  role="button"
                  tabIndex={0}
                  aria-label={`${author.full_name}: ${t('authors.details')}`}
                  onClick={() => setSelectedId(author.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(author.id)
                    }
                  }}
                >
                  <div className={styles.avatar}>
                    {img ? <img src={img} alt={author.full_name} loading="lazy" /> : <span>👤</span>}
                  </div>
                  <h2>{author.full_name}</h2>
                  <p className={styles.about}>
                    {author.about || t('home.noAuthorInfo')}
                  </p>
                  <Link
                    to={`/books?author=${author.id}`}
                    className={styles.link}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {count > 0 ? t('authors.viewBooksN', { n: count }) : t('authors.viewBooks')}
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {selectedAuthor && (
        <div className={styles.overlay} onClick={() => setSelectedId(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={selectedAuthor.full_name}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.close} aria-label={t('authors.close')} onClick={() => setSelectedId(null)}>✕</button>

            <div className={styles.modalHead}>
              <div className={styles.modalAvatar}>
                {getImgUrl(selectedAuthor.photo)
                  ? <img src={getImgUrl(selectedAuthor.photo)} alt={selectedAuthor.full_name} />
                  : <span>👤</span>}
              </div>
              <div>
                <p className={styles.eyebrow}>{t('authors.eyebrow')}</p>
                <h2>{selectedAuthor.full_name}</h2>
                <p className={styles.sub}>{t('menu.booksCount', { n: selectedBooks.length })}</p>
              </div>
            </div>

            <section className={styles.infoBlock}>
              <h3>{t('authors.about')}</h3>
              <p className={styles.modalAbout}>{selectedAuthor.about || t('home.noAuthorInfo')}</p>
            </section>

            <section className={styles.infoBlock}>
              <h3>{t('authors.books')}</h3>
              {selectedBooks.length === 0 ? (
                <p className={styles.modalAbout}>{t('authors.noBooks')}</p>
              ) : (
                <ul className={styles.bookList}>
                  {selectedBooks.map((book) => (
                    <li key={book.id}>
                      <Link to={`/books/${book.id}`} state={{ book }}>
                        <span>{book.name}</span>
                        {book.price && <em>{Number(book.price).toLocaleString(locale)} {t('currency')}</em>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {selectedBooks.length > 0 && (
                <Link to={`/books?author=${selectedAuthor.id}`} className={styles.link}>
                  {t('authors.allBooksOf')}
                </Link>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  )
}
