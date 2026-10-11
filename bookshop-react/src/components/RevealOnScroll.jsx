import { useEffect } from 'react'

// data-reveal belgisi qo'yilgan elementlar ko'rinish maydoniga kirganda animatsiya bilan chiqadi
// ("Biz haqimizda" sahifasidagi missiya blokidek). Yangi sahifa yoki kech yuklangan
// ma'lumotlar (kitoblar ro'yxati va h.k.) ham avtomatik kuzatiladi.
export default function RevealOnScroll() {
  useEffect(() => {
    const root = document.documentElement
    if (!root.classList.contains('reveal-ready')) return undefined

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.setAttribute('data-revealed', '')
          io.unobserve(entry.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )

    const watch = (node) => {
      if (node.nodeType !== 1) return
      if (node.matches('[data-reveal]:not([data-revealed])')) io.observe(node)
      node.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((el) => io.observe(el))
    }

    watch(document.body)
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach(watch))
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  return null
}
