import styles from '../pages/Profile.module.css'

const STAGES = ['confirmed', 'processing', 'shipped', 'delivered']

// Buyurtma bosqichlari: qabul qilindi -> yig'ilmoqda -> yo'lda -> yetkazildi
export default function OrderProgress({ order, t, locale }) {
  const when = (status) => {
    const event = (order.events || []).find((e) => e.status === status)
    return event ? new Date(event.created_on).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : ''
  }

  if (order.status === 'cancelled') {
    const date = when('cancelled')
    return (
      <p className={styles.cancelledLine}>
        ✕ {t('order.cancelled')}{date ? ` · ${date}` : ''}
      </p>
    )
  }

  const current = Math.max(0, STAGES.indexOf(order.status))
  return (
    <ol className={styles.progress} aria-label={t(`order.${order.status}`)}>
      {STAGES.map((stage, index) => (
        <li
          key={stage}
          className={`${styles.step} ${index <= current ? styles.stepDone : ''} ${index === current ? styles.stepNow : ''}`}
        >
          <span className={styles.stepDot} aria-hidden="true">{index < current ? '✓' : index + 1}</span>
          <span className={styles.stepLabel}>{t(`order.${stage}`)}</span>
          <small>{index <= current ? when(stage) : ''}</small>
        </li>
      ))}
    </ol>
  )
}
