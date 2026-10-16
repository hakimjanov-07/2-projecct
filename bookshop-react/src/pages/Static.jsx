import { SITE } from '../config/site'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Static.module.css'

const FEATURES = [
  { key: 'f1', image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=300&q=85' },
  { key: 'f2', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=85' },
  { key: 'f3', image: 'https://images.unsplash.com/photo-1589998059171-988d887df646?auto=format&fit=crop&w=300&q=85' },
  { key: 'f4', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=85' },
]

const ARTICLES = [
  { key: 'a1', image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=85', minutes: 3 },
  { key: 'a2', image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85', minutes: 5 },
  { key: 'a3', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=85', minutes: 4 },
  { key: 'a4', image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=85', minutes: 6 },
  { key: 'a5', image: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=85', minutes: 4 },
  { key: 'a6', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=85', minutes: 3 },
]

export function About() {
  const { t } = useLang()
  useDocumentTitle(t('title.about'))
  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.aboutHero}`}>
        <p className={styles.eyebrow}>{t('title.about')}</p>
        <h1>BOOK.UZ</h1>
        <p>{t('about.lead')}</p>
      </div>

      <div className={styles.content}>
        <div className={`${styles.block} ${styles.missionBlock}`}>
          <h2>{t('about.missionTitle')}</h2>
          <p>{t('about.missionText')}</p>
        </div>

        <div className={styles.block}>
          <h2>{t('about.whyTitle')}</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div key={f.key} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <img src={f.image} alt="" />
                </span>
                <p className={styles.featureTitle}>{t(`about.${f.key}.title`)}</p>
                <p className={styles.featureDesc}>{t(`about.${f.key}.desc`, { hours: SITE.workingHours })}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export function Articles() {
  const { t } = useLang()
  useDocumentTitle(t('title.articles'))

  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.articlesHero}`} data-reveal>
        <p className={styles.eyebrow}>{t('title.articles')}</p>
        <h1>{t('articles.title')}</h1>
        <p>{t('articles.lead')}</p>
      </div>

      <div className={styles.content}>
        <div className={styles.articlesGrid}>
          {ARTICLES.map((a) => (
            <div key={a.key} className={styles.articleCard} data-reveal>
              <div className={styles.articleImg}>
                <img src={a.image} alt="" />
              </div>
              <div className={styles.articleBody}>
                <p className={styles.articleTitle}>{t(`articles.${a.key}.title`)}</p>
                <p className={styles.articleExcerpt}>{t(`articles.${a.key}.text`)}</p>
                <p className={styles.articleMeta}>{t('articles.readTime', { time: t('articles.min', { n: a.minutes }) })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
