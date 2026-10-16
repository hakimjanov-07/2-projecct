import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getAllBooks, getAuthors, getCategories } from '../api'
import BookCard from '../components/BookCard'
import ErrorMessage from '../components/ErrorMessage'
import { categoriesWithBooks } from '../categories'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Home.module.css'

export default function Home() {
  const { t } = useLang()
  useDocumentTitle(t('title.home'))
  const [books, setBooks] = useState([])
  const [authors, setAuthors] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  // Har bo'lim o'z xatosiga ega: bittasi yiqilsa qolganlari ko'rinishda qoladi
  const [errors, setErrors] = useState({ books: false, authors: false, categories: false })
  const sliderRef = useRef(null)

  const loadData = () => {
    setLoading(true)
    setErrors({ books: false, authors: false, categories: false })
    Promise.allSettled([
      getAllBooks(),
      getAuthors(),
      getCategories(),
    ]).then(([bRes, aRes, cRes]) => {
      if (bRes.status === 'fulfilled') setBooks(bRes.value.data.results || [])
      if (aRes.status === 'fulfilled') setAuthors(aRes.value.data.results || [])
      if (cRes.status === 'fulfilled') setCategories(cRes.value.data.results || [])
      setErrors({
        books: bRes.status === 'rejected',
        authors: aRes.status === 'rejected',
        categories: cRes.status === 'rejected',
      })
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  const handleSliderWheel = (event) => {
    const el = sliderRef.current
    if (!el) return

    event.preventDefault()
    event.stopPropagation()
    el.scrollBy({
      left: event.deltaY || event.deltaX,
      behavior: 'smooth',
    })
  }

  const handleHorizontalScroll = (event) => {
    const el = event.currentTarget
    if (!el) return

    event.preventDefault()
    event.stopPropagation()

    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX

    if (delta !== 0) {
      el.scrollLeft += delta
    }
  }

  const topBooks = books.slice(0, 10)

  return (
    <main>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroContent} data-reveal>
          <p className={styles.eyebrow}>{t('home.eyebrow')}</p>
          <h1 className={styles.heroTitle}>{t('home.heroTitle1')}<br />{t('home.heroTitle2')}</h1>
          <p className={styles.heroDescription}>
            {t('home.heroText')}
          </p>

          <div className={styles.heroActions}>
            <Link to="/books" className={styles.btnDark}>{t('home.viewBooks')}</Link>
            <Link to="/books" className={styles.btnLight}>{t('home.categoriesBtn')}</Link>
          </div>
        </div>
      </section>

      {/* KATEGORIYALAR */}
      <section className={styles.catSection} data-reveal>
        <div className="container">
          <div className={styles.catRow}>
            <span className={styles.catLabel}>{t('home.categoriesLabel')}</span>
            <div className={styles.catRowScroll} onWheel={handleHorizontalScroll}>
              <Link to="/books" className={styles.catPill + ' ' + styles.catActive}>{t('home.all')}</Link>
              {categoriesWithBooks(categories, books).map(cat => (
                <Link key={cat.id} to={`/books?category=${cat.id}`} className={styles.catPill}>
                  {cat.name}
                </Link>
              ))}
              {errors.categories && !loading && (
                <button type="button" className={`${styles.catPill} ${styles.catRetry}`} title={t('common.error')} onClick={loadData}>
                  {t('common.retry')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TOP KITOBLAR */}
      <section className={styles.section} data-reveal>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('home.topBooks')}</h2>
          </div>

          {loading ? (
            <p className="loading">{t('common.loading')}</p>
          ) : errors.books ? (
            <ErrorMessage message={t('books.loadError')} onRetry={loadData} />
          ) : (
            <div className={styles.slider} ref={sliderRef} onWheel={handleSliderWheel}>
              {topBooks.map(book => (
                <div key={book.id} className={styles.sliderItem}>
                  <BookCard book={book} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MUALLIFLAR */}
      <section className={styles.sectionWhite} data-reveal>
        <div className="container">
          <h2 className={styles.sectionTitle} style={{ marginBottom: 28 }}>{t('home.popularAuthors')}</h2>
          {errors.authors && !loading && <ErrorMessage message={t('authors.loadError')} onRetry={loadData} />}
          <div className={styles.authorsRowScroll} onWheel={handleHorizontalScroll}>
            {authors.map(author => {
              const BASE = import.meta.env.VITE_API_URL || ''
              const img = author.photo
                ? (author.photo.startsWith('http') ? author.photo : BASE + author.photo)
                : null
              return (
                <div key={author.id} className={styles.authorCard} data-reveal>
                  <div className={styles.authorAvatarWrap}>
                    <div className={styles.authorAvatar}>
                      {img
                        ? <img src={img} alt={author.full_name} />
                        : <span>👤</span>}
                    </div>
                  </div>
                  <div className={styles.authorDetail}>
                    <p className={styles.authorDetailTitle}>{author.full_name}</p>
                    <p className={styles.authorDetailText}>
                      {author.about || t('home.noAuthorInfo')}
                    </p>
                  </div>
                  <p className={styles.authorName}>{author.full_name}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* BIZ HAQIMIZDA */}
      <section className={styles.aboutSection} data-reveal>
        <div className="container">
          <div className={styles.aboutGrid}>
            <div className={styles.aboutImageWrap}>
              <img
                className={styles.aboutImage}
                src="https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1200&q=85"
                alt=""
              />
            </div>
            <div className={styles.aboutContent}>
              <p className={styles.aboutEyebrow}>{t('home.aboutEyebrow')}</p>
              <h2 className={styles.aboutTitle}>{t('home.aboutTitle')}</h2>
              <p className={styles.aboutText}>
                {t('home.aboutText')}
              </p>
              <Link to="/about" className={styles.aboutButton}>{t('home.aboutMore')}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* IQTIBOS */}
      <section className={styles.quoteSection} data-reveal>
        <p className={styles.quoteEyebrow}>{t('home.quoteEyebrow')}</p>
        <blockquote className={styles.quoteText}>
          {t('home.quote')}
        </blockquote>
        <p className={styles.quoteTag}>{t('home.quoteTag')}</p>
      </section>

      {/* MAQOLALAR */}
      <section className={styles.section} data-reveal>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('home.articles')}</h2>
            <Link to="/articles" className={styles.seeAll}>{t('home.seeAll')}</Link>
          </div>
          <div className={styles.articlesGrid}>
            {[
              { image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=85', title: t('home.article1.title'), excerpt: t('home.article1.text'), time: t('home.article1.time') },
              { image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85', title: t('home.article2.title'), excerpt: t('home.article2.text'), time: t('home.article2.time') },
              { image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=85', title: t('home.article3.title'), excerpt: t('home.article3.text'), time: t('home.article3.time') },
            ].map((a, i) => (
              <div key={i} className={styles.articleCard} data-reveal>
                <div className={styles.articleImg}><img src={a.image} alt="" /></div>
                <div className={styles.articleBody}>
                  <p className={styles.articleTitle}>{a.title}</p>
                  <p className={styles.articleExcerpt}>{a.excerpt}</p>
                  <p className={styles.articleMeta}>{t('home.readTime', { time: a.time })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
