import { useLang } from '../i18n/LanguageContext'
import styles from './ErrorMessage.module.css'

export default function ErrorMessage({ message, onRetry }) {
  const { t } = useLang()

  return (
    <div className={styles.errorWrap} role="alert">
      <div className={styles.icon} aria-hidden="true">⚠️</div>
      <p className={styles.message}>{message || t('common.error')}</p>
      {onRetry && (
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
