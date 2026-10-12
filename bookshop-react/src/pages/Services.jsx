import { Link } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext'
import styles from './Static.module.css'

// "Xizmatlar" bo'limi: har bir yordam sahifasi uchun alohida tugma
const SERVICES = [
  {
    to: '/help/payment',
    titleKey: 'nav.payment',
    descKey: 'services.paymentDesc',
    image: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=900&q=85',
  },
  {
    to: '/help/delivery',
    titleKey: 'nav.delivery',
    descKey: 'services.deliveryDesc',
    image: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&w=900&q=85',
    position: 'center 65%',
  },
]

export default function Services() {
  const { t } = useLang()

  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.helpHero} ${styles.servicesHero}`}>
        <h1>{t('services.title')}</h1>
        <p>{t('services.lead')}</p>
      </div>

      <div className={styles.content}>
        <div className={styles.servicesGrid}>
          {SERVICES.map((item) => (
            <Link key={item.to} to={item.to} className={styles.serviceCard} data-reveal>
              <div className={styles.serviceImg}>
                <img src={item.image} alt="" style={{ objectPosition: item.position }} />
              </div>
              <div className={styles.serviceBody}>
                <h2>{t(item.titleKey)}</h2>
                <p>{t(item.descKey)}</p>
                <span className={styles.serviceBtn}>{t('services.open')} ›</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
