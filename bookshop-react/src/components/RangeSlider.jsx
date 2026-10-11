import styles from './RangeSlider.module.css'

// Ikki tutqichli slayder: low va high qiymatlari alohida o'zgaradi
export default function RangeSlider({ min = 0, max, step = 1000, low, high, onChange, lowLabel, highLabel }) {
  const toPercent = (value) => (max > min ? ((value - min) / (max - min)) * 100 : 0)

  const handleLow = (event) => {
    const next = Math.min(Number(event.target.value), high - step)
    onChange(Math.max(min, next), high)
  }

  const handleHigh = (event) => {
    const next = Math.max(Number(event.target.value), low + step)
    onChange(low, Math.min(max, next))
  }

  return (
    <div className={styles.slider} style={{ '--low': `${toPercent(low)}%`, '--high': `${toPercent(high)}%` }}>
      <div className={styles.track} />
      <div className={styles.fill} />
      <input
        type="range"
        className={styles.thumb}
        min={min}
        max={max}
        step={step}
        value={low}
        aria-label={lowLabel}
        // Tutqichlar ustma-ust tushganda chap tutqichni ham ushlab olish uchun
        style={{ zIndex: low >= max - step * 2 ? 3 : 1 }}
        onChange={handleLow}
      />
      <input
        type="range"
        className={styles.thumb}
        min={min}
        max={max}
        step={step}
        value={high}
        aria-label={highLabel}
        style={{ zIndex: 2 }}
        onChange={handleHigh}
      />
    </div>
  )
}
