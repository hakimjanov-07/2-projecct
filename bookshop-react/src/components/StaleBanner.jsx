import { useEffect, useRef, useState } from 'react'
import { STALE_EVENT, FRESH_EVENT } from '../api'
import { useLang } from '../i18n/LanguageContext'
import styles from './StaleBanner.module.css'

const HIDE_MS = 8000

// API yiqilib ma'lumot keshdan ko'rsatilganda yupqa ogohlantirish.
// 8 soniyadan keyin yoki shu so'rov keyin muvaffaqiyatli bo'lganda yo'qoladi.
export default function StaleBanner() {
  const { t } = useLang()
  const [visible, setVisible] = useState(false)
  const staleKeys = useRef(new Set())
  const timer = useRef(null)

  useEffect(() => {
    const hide = () => {
      clearTimeout(timer.current)
      staleKeys.current.clear()
      setVisible(false)
    }
    const onStale = (event) => {
      staleKeys.current.add(event.detail?.key)
      setVisible(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(hide, HIDE_MS)
    }
    const onFresh = (event) => {
      // Faqat keshdan ko'rsatilgan so'rovning o'zi yangilansa; boshqa so'rovlar muvaffaqiyati bannerni yashirmaydi
      if (staleKeys.current.delete(event.detail?.key) && staleKeys.current.size === 0) hide()
    }
    window.addEventListener(STALE_EVENT, onStale)
    window.addEventListener(FRESH_EVENT, onFresh)
    return () => {
      window.removeEventListener(STALE_EVENT, onStale)
      window.removeEventListener(FRESH_EVENT, onFresh)
      clearTimeout(timer.current)
    }
  }, [])

  // role="status" konteyneri doim DOM'da: matn paydo bo'lganda ekran o'qigichlar e'lon qiladi
  return (
    <div role="status">
      {visible && <p className={styles.banner}>{t('stale.notice')}</p>}
    </div>
  )
}
