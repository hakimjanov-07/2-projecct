import { useState } from 'react'

// Muqova: rasm yo'q yoki yuklanmasa, nom bosh harfi bilan placeholder
export default function Cover({ book, className }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={`ws-cover ${className || ''}`}>
      {book.photo_url && !broken
        ? <img src={book.photo_url} alt="" loading="lazy" onError={() => setBroken(true)} />
        : <span className="ws-cover-ph" aria-hidden="true">{(book.name || '?').trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}
