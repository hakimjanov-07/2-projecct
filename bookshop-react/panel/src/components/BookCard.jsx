import { money } from '../format'
import Cover from './Cover'

// Kitob kartasi (saytdagi kartaga o'xshash, lekin savat va yurak yo'q): narx joyida kiritish maydoni.
// onOpen berilsa, karta (narx inputidan tashqari) bosiladi; children narx ostida (masalan, Saqlash tugmalari).
export default function BookCard({ book, price, onPrice, onOpen, onRemove, error, expandedHint, children }) {
  const original = book.price == null ? '' : String(book.price)
  const changed = price !== original
  const open = () => onOpen && onOpen(book)

  const info = (
    <>
      <Cover book={book} className="ws-card-cover" />
      <div className="ws-card-info">
        <small className="ws-card-cat">{book.category_name}</small>
        <h3>{book.name}</h3>
        <p>{book.author_name}</p>
      </div>
    </>
  )

  return (
    <div className="ws-card">
      {onRemove && (
        <button type="button" className="ws-card-x" aria-label={`${book.name}: tanlovdan chiqarish`} title="Tanlovdan chiqarish" onClick={() => onRemove(book, changed)}>×</button>
      )}
      {onOpen ? (
        <div
          className="ws-card-hit"
          role="button"
          tabIndex={0}
          aria-expanded={expandedHint ? 'false' : undefined}
          aria-label={`${book.name}: to'liq tahrirlash`}
          onClick={open}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
        >
          {info}
        </div>
      ) : <div className="ws-card-hit static">{info}</div>}
      <div className={`ws-card-price ${error ? 'has-error' : ''}`}>
        <label className={`ws-price-input ${changed ? 'changed' : ''}`}>
          <input
            type="number" min="1" step="1" inputMode="numeric" aria-label={`${book.name}: narx (so'm)`}
            value={price}
            onChange={(e) => onPrice(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <span>so'm</span>
        </label>
        {changed && <small className="ws-card-diff">{book.price ? money(book.price) : "narx yo'q"} → {price ? money(price) : '—'}</small>}
        {error && <small className="field-error">{error}</small>}
        {children}
      </div>
    </div>
  )
}
