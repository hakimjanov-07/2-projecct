import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Sahifa almashganda tepaga qaytaradi
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}
