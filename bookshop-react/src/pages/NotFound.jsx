import { Link } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './NotFound.module.css'

// 404: mavjud bo'lmagan manzil (App.jsx dagi `*` marshrut va noma'lum /help/<sahifa>)
export default function NotFound() {
  const { t } = useLang()
  useDocumentTitle(`404 — ${t('notFound.title')}`)

  return (
    <main className={styles.page}>
      <div className={styles.box}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>{t('notFound.title')}</h1>
        <p className={styles.text}>{t('notFound.text')}</p>
        <div className={styles.actions}>
          <Link to="/" className={styles.primary}>{t('notFound.home')}</Link>
          <Link to="/books" className={styles.secondary}>{t('notFound.books')}</Link>
        </div>
      </div>
    </main>
  )
}
