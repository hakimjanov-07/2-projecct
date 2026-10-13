import { useLang } from '../i18n/LanguageContext'
import styles from './SearchSuggest.module.css'

// Qidiruv takliflari ro'yxati (kitoblar, mualliflar, "hammasini ko'rish")
export default function SearchSuggest({ query, loading, items, activeIndex, onPick, onHover }) {
  const { t, locale } = useLang()
  const books = items.filter((item) => item.type === 'book')
  const authors = items.filter((item) => item.type === 'author')
  const all = items.find((item) => item.type === 'all')
  const empty = !loading && books.length === 0 && authors.length === 0

  const row = (item, children) => (
    <li key={`${item.type}-${item.id ?? 'all'}`}>
      <button
        type="button"
        role="option"
        aria-selected={items.indexOf(item) === activeIndex}
        className={`${styles.item} ${items.indexOf(item) === activeIndex ? styles.active : ''}`}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => onHover(items.indexOf(item))}
        onClick={() => onPick(item)}
      >
        {children}
      </button>
    </li>
  )

  return (
    <div className={styles.panel} role="listbox" aria-label={t('search.suggestions')}>
      {loading && <p className={styles.state}>{t('search.loading')}</p>}
      {empty && <p className={styles.state}>{t('search.empty')}</p>}

      {books.length > 0 && (
        <>
          <p className={styles.group}>{t('search.books')}</p>
          <ul>
            {books.map((item) => row(item, (
              <>
                <span className={styles.thumb}>{item.photo ? <img src={item.photo} alt="" /> : '📗'}</span>
                <span className={styles.text}>
                  <strong>{item.name}</strong>
                  {item.author && <small>{item.author}</small>}
                </span>
                {item.price ? <span className={styles.price}>{Number(item.price).toLocaleString(locale)} {t('currency')}</span> : null}
              </>
            )))}
          </ul>
        </>
      )}

      {authors.length > 0 && (
        <>
          <p className={styles.group}>{t('search.authors')}</p>
          <ul>
            {authors.map((item) => row(item, (
              <>
                <span className={`${styles.thumb} ${styles.round}`}>
                  {item.photo ? <img src={item.photo} alt="" /> : (item.name.charAt(0) || '?').toUpperCase()}
                </span>
                <span className={styles.text}><strong>{item.name}</strong></span>
              </>
            )))}
          </ul>
        </>
      )}

      {all && (
        <ul>
          {row(all, <span className={styles.all}>{t('search.seeAll', { q: query.trim() })} →</span>)}
        </ul>
      )}
    </div>
  )
}
