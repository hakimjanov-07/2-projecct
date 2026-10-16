import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllBooks, getCategories } from '../api'
import { categoriesWithBooks } from '../categories'
import { useLang } from '../i18n/LanguageContext'
import styles from './CategoryMenu.module.css'

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    </svg>
  )
}


export default function CategoryMenu({ open, onClose }) {
  const { t, locale } = useLang()
  const formatPrice = (price) => `${Number(price).toLocaleString(locale)} ${t('currency')}`
  const [categories, setCategories] = useState([])
  const [books, setBooks] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  // Ma'lumot menyu birinchi marta ochilganda yuklanadi
  useEffect(() => {
    if (!open || loaded) return
    let active = true

    Promise.allSettled([getCategories(), getAllBooks()]).then(([categoriesResult, booksResult]) => {
      if (!active) return
      if (categoriesResult.status === 'fulfilled') {
        const list = categoriesResult.value.data.results || []
        setCategories(list)
        setActiveId((current) => current ?? list[0]?.id ?? null)
      } else {
        setFailed(true)
      }
      if (booksResult.status === 'fulfilled') {
        const bookList = booksResult.value.data.results || []
        setBooks(bookList)
        // Kitobi bor birinchi janr avtomatik tanlanadi
        if (categoriesResult.status === 'fulfilled') {
          const first = (categoriesResult.value.data.results || []).find((c) => bookList.some((b) => b.category === c.id))
          if (first) setActiveId(first.id)
        }
      }
      setLoaded(true)
    })

    return () => { active = false }
  }, [open, loaded])

  const booksByCategory = useMemo(() => {
    const map = new Map()
    books.forEach((book) => {
      if (!map.has(book.category)) map.set(book.category, [])
      map.get(book.category).push(book)
    })
    return map
  }, [books])

  // Kitobi yo'q kategoriyalar menyuda ko'rsatilmaydi
  const visibleCategories = useMemo(() => categoriesWithBooks(categories, books), [categories, books])

  if (!open) return null

  const activeCategory = visibleCategories.find((category) => category.id === activeId)
  const activeBooks = booksByCategory.get(activeId) || []

  return (
    <div className={styles.panel} role="dialog" aria-label={t('menu.title')}>
      <div className={styles.header}>
        <span className={styles.headerIcon}><GridIcon /></span>
        <h2>{t('menu.title')}</h2>
        <Link to="/books" className={styles.allLink} onClick={onClose}>{t('menu.allBooks')}</Link>
      </div>

      {!loaded && <p className={styles.state}>{t('menu.loading')}</p>}
      {loaded && failed && <p className={styles.state}>{t('menu.failed')}</p>}
      {loaded && !failed && visibleCategories.length === 0 && <p className={styles.state}>{t('menu.noGenres')}</p>}

      {visibleCategories.length > 0 && (
        <div className={styles.body}>
          <ul className={styles.list}>
            {visibleCategories.map((category, index) => (
              <li key={category.id} style={{ '--i': Math.min(index, 10) }}>
                <Link
                  to={`/books?category=${category.id}`}
                  className={`${styles.item} ${category.id === activeId ? styles.itemActive : ''}`}
                  onMouseEnter={() => setActiveId(category.id)}
                  onFocus={() => setActiveId(category.id)}
                  onClick={onClose}
                >
                  <span className={styles.itemName}>{category.name}</span>
                  <span className={styles.count}>{booksByCategory.get(category.id)?.length || 0}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.detail}>
            <h3>{activeCategory?.name}</h3>
            <p className={styles.sub}>{t('menu.booksCount', { n: activeBooks.length })}</p>

            {activeBooks.length === 0 ? (
              <p className={styles.state}>{t('menu.noBooks')}</p>
            ) : (
              <div className={styles.cards}>
                {activeBooks.slice(0, 6).map((book) => (
                  <Link key={book.id} to={`/books/${book.id}`} className={styles.card} onClick={onClose}>
                    <strong>{book.name}</strong>
                    {book.author_name && <span>{book.author_name}</span>}
                    {book.price && <em>{formatPrice(book.price)}</em>}
                  </Link>
                ))}
              </div>
            )}

            {activeBooks.length > 6 && (
              <Link to={`/books?category=${activeId}`} className={styles.more} onClick={onClose}>
                {t('menu.more', { n: activeBooks.length - 6 })}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
