import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './ShareButtons.module.css'

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

// Kitobni ulashish: Telegram, Facebook, havolani nusxalash (va telefonda tizimning "Ulashish" oynasi)
export default function ShareButtons({ book }) {
  const { t } = useLang()
  const { showToast } = useToast()
  const url = window.location.href
  const text = book.author_name ? `${book.name} — ${book.author_name}` : book.name

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      showToast(t('share.copied'), { icon: '🔗' })
    } catch {
      window.prompt(t('share.copy'), url) // clipboard ruxsat berilmasa, qo'lda nusxalash oynasi
    }
  }

  const nativeShare = () => navigator.share({ title: book.name, text, url }).catch(() => {})

  return (
    <div className={styles.row} aria-label={t('share.title')}>
      <span className={styles.label}>{t('share.title')}</span>

      <a
        className={styles.btn}
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        title="Telegram"
      >
        <Icon><path d="M21 4 3 11l5.5 2L10 19l3-4 4.5 3.5L21 4ZM8.5 13 17 7.5" /></Icon>
        Telegram
      </a>

      <a
        className={styles.btn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        title="Facebook"
      >
        <Icon><path d="M14 8V6.5c0-.8.4-1.5 1.5-1.5H17V2h-2.5C11.8 2 10.5 3.8 10.5 6v2H8v3h2.5v10H14V11h2.7l.3-3H14Z" /></Icon>
        Facebook
      </a>

      <button type="button" className={styles.btn} onClick={copy} title={t('share.copy')}>
        <Icon><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Icon>
        {t('share.copy')}
      </button>

      {typeof navigator.share === 'function' && (
        <button type="button" className={styles.btn} onClick={nativeShare}>
          <Icon><path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Icon>
          {t('share.more')}
        </button>
      )}
    </div>
  )
}
