import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAllBooks, getCategories, getAuthors } from '../api'
import BookCard from '../components/BookCard'
import { categoriesWithBooks } from '../categories'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import FilterSelect from '../components/FilterSelect'
import RangeSlider from '../components/RangeSlider'
import SortSelect from '../components/SortSelect'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Books.module.css'

// Narx slayderining zaxira yuqori chegarasi (so'm; kitoblar yuklanmaguncha) va qadami
const DEFAULT_MAX_PRICE = 1000000
const PRICE_STEP = 10000

// Kitoblar sonini berilgan maydon bo'yicha sanaydi
const countBy = (books, key) => books.reduce((map, book) => map.set(book[key], (map.get(book[key]) || 0) + 1), new Map())

export default function Books() {
  const { t, locale } = useLang()
  useDocumentTitle(t('title.books'))
  const [searchParams, setSearchParams] = useSearchParams()
  const [books, setBooks] = useState([])
  const [categories, setCategories] = useState([])
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const urlSearch = searchParams.get('search') || ''
  const urlCategory = searchParams.get('category') || null
  const urlAuthor = searchParams.get('author') || null

  const [search, setSearch] = useState(urlSearch)
  const [selectedCat, setSelectedCat] = useState(urlCategory ? Number(urlCategory) : null)
  const [selectedAuthor, setSelectedAuthor] = useState(urlAuthor ? Number(urlAuthor) : null)
  const [selectedLang, setSelectedLang] = useState(null)
  const [selectedPublisher, setSelectedPublisher] = useState(null)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(urlSearch)
    setSelectedCat(urlCategory ? Number(urlCategory) : null)
    setSelectedAuthor(urlAuthor ? Number(urlAuthor) : null)
  }, [urlSearch, urlCategory, urlAuthor])

  const loadData = () => {
    setLoading(true)
    setError(false)
    Promise.allSettled([
      getAllBooks(),
      getCategories(),
      getAuthors(),
    ]).then(([booksResult, categoriesResult, authorsResult]) => {
      if (booksResult.status === 'fulfilled') setBooks(booksResult.value.data.results || [])
      if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value.data.results || [])
      if (authorsResult.status === 'fulfilled') setAuthors(authorsResult.value.data.results || [])
      // Kitoblar yuklanmasa xato ko'rsatiladi ("Kitob topilmadi" emas); janr/muallif yiqilsa kitoblar baribir chiqadi
      if (booksResult.status === 'rejected') setError(true)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  // Slayder chegarasi eng qimmat kitob narxidan (qadamga yuqoriga yaxlitlab) olinadi
  const MAX_PRICE = useMemo(() => {
    const top = books.reduce((max, b) => Math.max(max, parseFloat(b.price) || 0), 0)
    return top > 0 ? Math.ceil(top / PRICE_STEP) * PRICE_STEP : DEFAULT_MAX_PRICE
  }, [books])

  const filtered = useMemo(() => {
    let list = [...books]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.author_name || '').toLowerCase().includes(q) ||
          (b.category_name || '').toLowerCase().includes(q) ||
          (b.about || '').toLowerCase().includes(q)
      )
    }
    if (selectedCat) list = list.filter((b) => b.category === selectedCat)
    if (selectedAuthor) list = list.filter((b) => b.author === selectedAuthor)
    if (selectedLang) list = list.filter((b) => b.language === selectedLang)
    if (selectedPublisher) list = list.filter((b) => b.publisher === selectedPublisher)
    if (priceMin) list = list.filter((b) => parseFloat(b.price) >= parseFloat(priceMin))
    if (priceMax) list = list.filter((b) => parseFloat(b.price) <= parseFloat(priceMax))

    list.sort((a, b) => {
      if (sort === 'name_az') return a.name.localeCompare(b.name)
      if (sort === 'name_za') return b.name.localeCompare(a.name)
      if (sort === 'price_asc') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0)
      if (sort === 'price_desc') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0)
      if (sort === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0)
      return new Date(b.created_on) - new Date(a.created_on)
    })
    return list
  }, [books, search, selectedCat, selectedAuthor, selectedLang, selectedPublisher, priceMin, priceMax, sort])

  const categoryOptions = useMemo(() => {
    const counts = countBy(books, 'category')
    // Kitobi yo'q kategoriyalar chiqmaydi (URL'da tanlangani qoladi)
    return categoriesWithBooks(categories, books, selectedCat).map((c) => ({ value: c.id, label: c.name, count: counts.get(c.id) || 0 }))
  }, [categories, books, selectedCat])

  const authorOptions = useMemo(() => {
    const counts = countBy(books, 'author')
    return authors.map((a) => ({ value: a.id, label: a.full_name, count: counts.get(a.id) || 0 }))
  }, [authors, books])

  const publisherOptions = useMemo(() => {
    const counts = countBy(books, 'publisher')
    return [...counts.keys()].filter(Boolean).sort().map((p) => ({ value: p, label: p, count: counts.get(p) }))
  }, [books])

  const languageCodes = useMemo(() => [...new Set(books.map((b) => b.language).filter(Boolean))], [books])


  const clearFilters = () => {
    setSearch('')
    setSelectedCat(null)
    setSelectedAuthor(null)
    setSelectedLang(null)
    setSelectedPublisher(null)
    setPriceMin('')
    setPriceMax('')
    setSort('newest')
    setSearchParams({})
  }

  return (
    <main>
      <div className={styles.hero} data-reveal>
        <h1>{t('books.title')}</h1>
        <p>{t('books.subtitle')}</p>
      </div>

      <div className={styles.layout}>
        <aside className={styles.filters} data-reveal>
          <div className={styles.filtersHead}>
            <h2 className={styles.filtersTitle}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></svg>
              {t('books.filters')}
            </h2>
            <button type="button" className={styles.clearLink} onClick={clearFilters}>{t('books.clear')}</button>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t('books.language')}</span>
            <div className={styles.chips}>
              <button
                type="button"
                className={`${styles.chip} ${!selectedLang ? styles.chipActive : ''}`}
                onClick={() => setSelectedLang(null)}
              >
                {t('books.allLanguages')}
              </button>
              {languageCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`${styles.chip} ${selectedLang === code ? styles.chipActive : ''}`}
                  onClick={() => setSelectedLang(selectedLang === code ? null : code)}
                >
                  {t(`lang.${code}`)}
                </button>
              ))}
            </div>
          </div>

          <FilterSelect
            label={t('books.genre')}
            placeholder={t('books.chooseGenre')}
            allLabel={t('books.allGenres')}
            options={categoryOptions}
            value={selectedCat}
            onChange={setSelectedCat}
          />
          <FilterSelect
            label={t('books.author')}
            placeholder={t('books.chooseAuthor')}
            allLabel={t('books.allAuthors')}
            options={authorOptions}
            value={selectedAuthor}
            onChange={setSelectedAuthor}
          />
          <FilterSelect
            label={t('books.publisher')}
            placeholder={t('books.choosePublisher')}
            allLabel={t('books.allPublishers')}
            options={publisherOptions}
            value={selectedPublisher}
            onChange={setSelectedPublisher}
          />

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t('books.priceRange')}</span>
            <div className={styles.priceBox}>
              <div className={styles.priceRow}>
                <input
                  type="number"
                  min="0"
                  className={styles.priceInput}
                  placeholder={t('books.priceMin')}
                  aria-label={t('books.priceMin')}
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  className={styles.priceInput}
                  placeholder={t('books.priceMax')}
                  aria-label={t('books.priceMax')}
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                />
              </div>
              <RangeSlider
                max={MAX_PRICE}
                step={PRICE_STEP}
                low={priceMin === '' ? 0 : Math.min(Number(priceMin), MAX_PRICE)}
                high={priceMax === '' ? MAX_PRICE : Math.min(Number(priceMax), MAX_PRICE)}
                lowLabel={t('books.priceMin')}
                highLabel={t('books.priceMax')}
                onChange={(low, high) => {
                  setPriceMin(low <= 0 ? '' : String(low))
                  setPriceMax(high >= MAX_PRICE ? '' : String(high))
                }}
              />
              <div className={styles.scale}>
                <span>0 {t('currency')}</span>
                <span>{MAX_PRICE.toLocaleString(locale)} {t('currency')}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          <div className={styles.toolbar} data-reveal>
            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4.2-4.2" />
              </svg>
              <input
                type="text"
                aria-label={t('books.searchPlaceholder')}
                placeholder={t('books.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className={styles.clearSearchBtn} aria-label={t('books.clear')} onClick={() => setSearch('')}>
                  ✕
                </button>
              )}
            </div>
            <SortSelect
              value={sort}
              onChange={setSort}
              label={t('books.sort.label')}
              options={[
                { value: 'newest', label: t('books.sort.newest') },
                { value: 'rating', label: t('books.sort.rating') },
                { value: 'name_az', label: t('books.sort.nameAz') },
                { value: 'name_za', label: t('books.sort.nameZa') },
                { value: 'price_asc', label: t('books.sort.priceAsc') },
                { value: 'price_desc', label: t('books.sort.priceDesc') },
              ]}
            />
          </div>

          {!error && <p className={styles.count}>{t('books.results', { n: filtered.length })}</p>}

          {loading ? (
            <LoadingSpinner text={t('books.loading')} />
          ) : error ? (
            <ErrorMessage message={t('books.loadError')} onRetry={loadData} />
          ) : filtered.length === 0 ? (
            <div className={styles.emptyWrap}>
              <p className={styles.emptyIcon}>📖</p>
              <p className={styles.emptyTitle}>{t('books.notFound')}</p>
              <p className={styles.emptyDesc}>{t('books.notFoundHint')}</p>
              <button className={styles.clearBtn} onClick={clearFilters}>
                {t('books.showAll')}
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
