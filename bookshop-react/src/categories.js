// Katalogda faqat kamida 1 ta (faol) kitobi bor kategoriyalar ko'rsatiladi.
// keepId: URL'da tanlangan kategoriya bo'sh bo'lsa ham ro'yxatda qoladi.
// Kitoblar yuklanmagan bo'lsa (xato) ro'yxat o'zgarmaydi.
export function categoriesWithBooks(categories, books, keepId = null) {
  if (!books.length) return categories
  const used = new Set(books.map((book) => book.category))
  return categories.filter((category) => used.has(category.id) || category.id === keepId)
}
