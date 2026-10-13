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
