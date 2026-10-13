import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initTheme } from './theme'

initTheme()

// Bo'limlarning animatsiya bilan chiqishi (RevealOnScroll). Brauzer qo'llab-quvvatlamasa
// yoki foydalanuvchi animatsiyani o'chirgan bo'lsa, hamma narsa darrov ko'rinadi.
if (
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  document.documentElement.classList.add('reveal-ready')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
