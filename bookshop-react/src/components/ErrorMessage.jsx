import styles from './ErrorMessage.module.css'

export default function ErrorMessage({ message = 'Xatolik yuz berdi', onRetry }) {
  return (
    <div className={styles.errorWrap}>
      <div className={styles.icon}>⚠️</div>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  )
}
