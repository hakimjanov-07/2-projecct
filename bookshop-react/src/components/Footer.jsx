import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SITE } from '../config/site'
import { useLang } from '../i18n/LanguageContext'
import styles from './Footer.module.css'

const SOCIAL_ICONS = {
  instagram: <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8a4 4 0 0 0 0-8Zm5.2-1.7h.01" />,
  telegram: <path d="M21 4 3 11l5.5 2L10 19l3-4 4.5 3.5L21 4ZM8.5 13 17 7.5" />,
  facebook: <path d="M14 8V6.5c0-.8.4-1.5 1.5-1.5H17V2h-2.5C11.8 2 10.5 3.8 10.5 6v2H8v3h2.5v10H14V11h2.7l.3-3H14Z" />,
  youtube: <path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Zm7 1.5v5l4.5-2.5L10 9.5Z" />,
}

function PhoneIcon() {
  return (
    <svg className={styles.phoneIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.9 4.5c.44 0 .8.36.8.8v2.5c0 .42-.32.78-.75.8l-1.1.08a11.9 11.9 0 0 0 8.35 8.35l.08-1.1a.8.8 0 0 1 .8-.75h2.5c.44 0 .8.36.8.8v2.2c0 .8-.65 1.45-1.45 1.45A15.8 15.8 0 0 1 4.8 6.45A1.45 1.45 0 0 1 6.25 5h.65Z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export default function Footer() {
  const { t } = useLang()
  const [showTop, setShowTop] = useState(false)
  const isLoggedIn = Boolean(localStorage.getItem('access_token'))
  const socials = Object.entries(SITE.social) // havolasi yo'qlari ham ko'rinadi (bosilmaydi), havola yozilsa ishlaydi

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol} data-reveal>
          <Link to="/" className={styles.logo}>
            <img src="/logo.svg" alt="" className={styles.logoMark} />
            BOOK.UZ
          </Link>
          <p className={styles.tagline}>{t('footer.tagline')}</p>

          {socials.length > 0 && (
            <>
              <h3 className={styles.followTitle}>{t('footer.follow')}</h3>
              <div className={styles.socials}>
                {socials.map(([name, url]) => {
                  const icon = <svg viewBox="0 0 24 24" aria-hidden="true">{SOCIAL_ICONS[name]}</svg>
                  return url ? (
                    <a key={name} href={url} target="_blank" rel="noreferrer" aria-label={name} title={name}>{icon}</a>
                  ) : (
                    <span key={name} className={styles.soon} aria-label={name} title={`${name}: ${t('footer.soon')}`}>{icon}</span>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <nav className={styles.col} aria-label={t('footer.platform')} data-reveal>
          <h3>{t('footer.platform')}</h3>
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/books">{t('nav.books')}</Link>
          <Link to="/authors">{t('nav.authors')}</Link>
          <Link to="/articles">{t('nav.news')}</Link>
          <Link to="/about">{t('nav.about')}</Link>
        </nav>

        <nav className={`${styles.col} ${styles.accent}`} aria-label={t('footer.account')} data-reveal>
          <h3>{t('footer.account')}</h3>
          {isLoggedIn ? (
            <Link to="/profile">{t('nav.openProfile')}</Link>
          ) : (
            <>
              <Link to="/login">{t('nav.login')}</Link>
              <Link to="/register">{t('nav.register')}</Link>
            </>
          )}
          <Link to="/my-books">{t('footer.myBooks')}</Link>
          <Link to="/cart">{t('footer.cart')}</Link>
        </nav>

        <div className={`${styles.col} ${styles.accent}`} data-reveal>
          <h3>{t('footer.contact')}</h3>
          <a href={`tel:${SITE.phoneLink}`} className={styles.contactCard}>
            <span className={styles.contactIcon}><PhoneIcon /></span>
            <strong>{SITE.phone}</strong>
          </a>
          <div className={styles.contactCard}>
            <span className={styles.contactIcon}><ClockIcon /></span>
            <span>
              <small>{t('footer.hours')}</small>
              <strong>{SITE.workingHours}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.bottom} data-reveal>
        <span className={styles.copy}>{t('footer.copy')}</span>
        <nav className={styles.legal} aria-label={t('footer.help')}>
          <Link to="/help/payment">{t('footer.payment')}</Link>
          <Link to="/help/delivery">{t('footer.delivery')}</Link>
          <Link to="/help/privacy">{t('footer.privacy')}</Link>
        </nav>
      </div>

      {showTop && (
        <button
          type="button"
          className={styles.toTop}
          aria-label={t('footer.toTop')}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      )}
    </footer>
  )
}
