import { useEffect, useState } from 'react'
import { searchSuggestions } from './api'

const MIN_LENGTH = 2
const DELAY = 250 // yozishdan keyin shuncha kutib so'raladi (har harfga emas)

// Qidiruv takliflari: kitoblar va mualliflar. Natija faqat hozirgi so'zga mos kelsa ko'rsatiladi.
export function useSuggestions(query, enabled) {
  const q = query.trim()
  const active = enabled && q.length >= MIN_LENGTH
  const [state, setState] = useState({ q: '', books: [], authors: [] })

  useEffect(() => {
    if (!active) return undefined
    let alive = true
    const timer = setTimeout(() => {
      searchSuggestions(q)
        .then((result) => alive && setState({ q, ...result }))
        .catch(() => alive && setState({ q, books: [], authors: [] }))
    }, DELAY)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q, active])

  const ready = active && state.q === q
  return {
    active,
    loading: active && !ready,
    books: ready ? state.books : [],
    authors: ready ? state.authors : [],
  }
}
