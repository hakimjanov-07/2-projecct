import { useCallback, useEffect, useRef, useState } from 'react'

// Ma'lumot yuklash: key o'zgarsa qayta yuklaydi, yuklanayotganda eski ma'lumot ko'rinib turadi.
export function useFetch(fetcher, key) {
  const [state, setState] = useState({ key: null, data: null, error: null })
  const [nonce, setNonce] = useState(0)
  const fetcherRef = useRef(fetcher)
  const fullKey = `${key}|${nonce}`

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let alive = true
    fetcherRef.current()
      .then((data) => alive && setState({ key: fullKey, data, error: null }))
      .catch((error) => alive && setState((prev) => ({ key: fullKey, data: prev.data, error })))
    return () => { alive = false }
  }, [fullKey])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data: state.data, error: state.error, loading: state.key !== fullKey, reload }
}
