import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'bookshop-cart'

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addToCart = (book, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === book.id)
      const limit = book.stock ?? Infinity // ombordagi soni (bo'sh = cheklanmagan)

      if (existing) {
        return current.map((item) =>
          item.id === book.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, limit), stock: book.stock ?? null }
            : item
        )
      }

      if (limit < 1) return current

      return [
        ...current,
        {
          id: book.id,
          name: book.name,
          price: Number(book.price || 0),
          photo: book.photo || '',
          category_name: book.category_name || '',
          stock: book.stock ?? null,
          quantity: Math.min(quantity, limit),
        },
      ]
    })
  }

  const removeFromCart = (id) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const updateQuantity = (id, delta) => {
    setItems((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.min(Math.max(0, item.quantity + delta), item.stock ?? Infinity) }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const clearCart = () => setItems([])

  // Savatni serverdagi joriy kitob ma'lumoti bilan sinxronlash: nom/narx/rasm yangilanadi, yo'q kitob olib tashlanadi.
  // O'zgarish bo'lmasa o'sha holat qaytadi (ortiqcha render va qayta so'rov bo'lmaydi).
  const syncItems = (lines, missing = []) => {
    const byId = new Map(lines.map((line) => [line.id, line]))
    const gone = new Set(missing)
    setItems((current) => {
      let changed = false
      const next = []
      for (const item of current) {
        const line = byId.get(item.id)
        if (!line) {
          if (gone.has(item.id)) {
            changed = true
            continue
          }
          next.push(item)
          continue
        }
        const stock = line.stock ?? null
        const quantity = Math.min(item.quantity, stock ?? Infinity)
        if (quantity < 1) {
          changed = true
          continue
        }
        const fresh = { ...item, name: line.name, price: Number(line.price), photo: line.photo || '', category_name: line.category_name || '', stock, quantity }
        if (Object.keys(fresh).some((key) => fresh[key] !== item[key])) changed = true
        next.push(fresh)
      }
      return changed ? next : current
    })
  }

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  )

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  )

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        syncItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }

  return context
}
