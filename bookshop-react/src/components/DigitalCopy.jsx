import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBookDigital } from '../api'
import { useLang } from '../i18n/LanguageContext'
import useAuthToken from '../useAuthToken'
import styles from './DigitalCopy.module.css'

// Kitobning audio va PDF nusxasi: faqat sotib olganlar uchun ochiladi
export default function DigitalCopy({ book }) {
  const { t } = useLang()
  const loggedIn = Boolean(useAuthToken())
  const hasFiles = Boolean(book.has_audio || book.has_pdf)
  const [result, setResult] = useState(null) // { id, links } yoki { id, locked: true }

  useEffect(() => {
    if (!hasFiles || !loggedIn) return undefined
    let alive = true
    getBookDigital(book.id)
      .then((response) => alive && setResult({ id: book.id, links: response.data }))
      .catch((error) => alive && setResult({ id: book.id, locked: error.response?.status === 403, failed: error.response?.status !== 403 }))
    return () => { alive = false }
  }, [book.id, hasFiles, loggedIn])

  if (!hasFiles) return null

  const current = result?.id === book.id ? result : null

  return (
    <section className={styles.box} aria-label={t('digital.title')}>
      <h3>{t('digital.title')}</h3>

      {!loggedIn && (
        <p className={styles.note}>
          <span aria-hidden="true">🔒</span> {t('digital.loginNeeded')}{' '}
          <Link to="/login" state={{ from: `/books/${book.id}` }}>{t('nav.login')}</Link>
        </p>
      )}

      {loggedIn && !current && <p className={styles.note}>{t('digital.loading')}</p>}
      {current?.locked && <p className={styles.note}><span aria-hidden="true">🔒</span> {t('digital.locked')}</p>}
      {current?.failed && <p className={styles.note}>{t('digital.error')}</p>}

      {current?.links && (
        <div className={styles.files}>
          {current.links.audio && (
            <div className={styles.audio}>
              <span>{t('book.audio')}</span>
              <audio controls preload="none" src={current.links.audio} />
            </div>
          )}
          {current.links.pdf && (
            <a className={styles.pdf} href={current.links.pdf} target="_blank" rel="noreferrer">
              {t('book.pdf')}
            </a>
          )}
        </div>
      )}
    </section>
  )
}
