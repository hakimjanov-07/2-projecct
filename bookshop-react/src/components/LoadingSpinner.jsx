import { useLang } from '../i18n/LanguageContext'
import styles from './LoadingSpinner.module.css'

export default function LoadingSpinner({ text }) {
  const { t } = useLang()
  const label = text === undefined ? t('common.loading') : text

  return (
    <div className={styles.spinnerWrap} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true"></div>
      {label && <p className={styles.text}>{label}</p>}
    </div>
  )
}
