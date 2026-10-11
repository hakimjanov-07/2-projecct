import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import styles from './PasswordInput.module.css'

function EyeIcon({ crossed }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  )
}

// Parol maydoni: ko'z belgisi bilan yashirish / ko'rsatish
export default function PasswordInput(props) {
  const { t } = useLang()
  const [visible, setVisible] = useState(false)

  return (
    <span className={styles.wrap}>
      <input {...props} className={styles.input} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className={styles.toggle}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        title={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
        // Tugma bosilganda maydondan fokus ketmasligi uchun
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon crossed={visible} />
      </button>
    </span>
  )
}
