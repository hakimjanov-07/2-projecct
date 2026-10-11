import styles from './LoadingSpinner.module.css'

export default function LoadingSpinner({ text = 'Yuklanmoqda...' }) {
  return (
    <div className={styles.spinnerWrap}>
      <div className={styles.spinner}></div>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  )
}
