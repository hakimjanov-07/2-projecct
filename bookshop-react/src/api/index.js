import axios from 'axios'
import { mockBooks, mockCategories, mockAuthors } from './mockData'

const USE_MOCK_API = String(import.meta.env.VITE_USE_MOCK_API ?? 'false').toLowerCase() === 'true'

const baseURL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://bookshoptest.pythonanywhere.com/api')
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 10000,
})

// Kirish/chiqish/sessiya tugashi: Navbar, Footer kabi komponentlar shu hodisa bilan yangilanadi (useAuthToken)
export const AUTH_EVENT = 'auth-changed'
export const notifyAuthChanged = () => window.dispatchEvent(new Event(AUTH_EVENT))

// Chiqishda shaxsiy ma'lumotlar ham o'chadi (email, yetkazib berish manzili: 'bookshop-delivery'); savat va sevimlilar qoladi
const SESSION_KEYS = ['access_token', 'refresh_token', 'username', 'user_info', 'user_email', 'bookshop-delivery']

export const clearSession = () => {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key))
  notifyAuthChanged()
}

// Token faqat foydalanuvchi kirgan bo'lsa yuboriladi (login/register uchun skipAuth)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Access token eskirganda refresh token bilan bir marta yangilab, so'rovni qaytaramiz
let refreshPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const refreshToken = localStorage.getItem('refresh_token')

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || originalRequest.skipAuth || !refreshToken) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      refreshPromise ??= axios
        .post(`${baseURL}/token/refresh/`, { refresh: refreshToken })
        .finally(() => { refreshPromise = null })
      const response = await refreshPromise
      localStorage.setItem('access_token', response.data.access)
      originalRequest.headers.Authorization = `Bearer ${response.data.access}`
      return api(originalRequest)
    } catch (refreshError) {
      clearSession()
      return Promise.reject(refreshError)
    }
  }
)

const cacheKey = (key) => `bookshop-api-${key}`

const readCache = (key) => {
  try {
    const value = sessionStorage.getItem(cacheKey(key))
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const writeCache = (key, data) => {
  try {
    sessionStorage.setItem(cacheKey(key), JSON.stringify(data))
  } catch {
    // Ignore unavailable browser storage.
  }
}

// Kesh ishlatilganda (API yiqildi) StaleBanner uchun hodisa; shu so'rov keyin muvaffaqiyatli bo'lsa FRESH_EVENT
export const STALE_EVENT = 'api-stale'
export const FRESH_EVENT = 'api-fresh'
const notifyCache = (name, key) => window.dispatchEvent(new CustomEvent(name, { detail: { key } }))

// Kesh kaliti barcha parametrlarni o'z ichiga oladi (tartiblangan), shuning uchun turli filtrlar bir-birining keshini bosmaydi
const listKey = (base, params = {}) => {
  const pairs = Object.keys(params)
    .filter((name) => params[name] !== undefined && params[name] !== null && params[name] !== '')
    .sort()
    .map((name) => [name, params[name]])
  return pairs.length ? `${base}-${JSON.stringify(pairs)}` : base
}

// mockData: qiymat yoki funksiya (funksiya faqat mock rejimda kerak bo'lganda chaqiriladi)
const withFallback = (key, requestFactory, mockData) =>
  requestFactory()
    .then((response) => {
      writeCache(key, response.data)
      notifyCache(FRESH_EVENT, key)
      return response
    })
    .catch((error) => {
      const fallbackData = readCache(key)
      if (fallbackData) {
        console.warn('Using cached API data:', key)
        notifyCache(STALE_EVENT, key)
        return Promise.resolve({ data: fallbackData })
      }

      if (!USE_MOCK_API) {
        return Promise.reject(error)
      }

      console.warn('Using mock API data for development:', error.message)
      return Promise.resolve({ data: typeof mockData === 'function' ? mockData() : mockData })
    })

// Keshdagi har qanday kitoblar ro'yxatidan (turli filtrlar) bitta kitobni qidiradi
const findCachedBook = (id) => {
  try {
    const prefix = cacheKey('books')
    for (let i = 0; i < sessionStorage.length; i++) {
      const name = sessionStorage.key(i)
      if (!name || !name.startsWith(prefix)) continue
      const found = JSON.parse(sessionStorage.getItem(name))?.results?.find((b) => String(b.id) === String(id))
      if (found) return found
    }
  } catch {
    // Ignore unavailable browser storage.
  }
  return undefined
}


const normalizeListResponse = (response) => {
  if (Array.isArray(response.data)) {
    return { ...response, data: { results: response.data } }
  }
  return response
}

export const getBooks = (params = {}) =>
  withFallback(
    listKey('books', params),
    () => api.get('/book/', { params: { status: 'active', ...params } }),
    mockBooks
  ).then(normalizeListResponse)

// Barcha sahifalarni yig'ib bitta ro'yxat qaytaradi (xavfsizlik: 20 sahifagacha, 2000 kitob)
const MAX_BOOK_PAGES = 20
const fetchAllBookPages = async (params) => {
  const first = await api.get('/book/', { params: { status: 'active', page_size: 100, ...params } })
  if (Array.isArray(first.data)) return { data: { results: first.data, count: first.data.length } }
  const results = [...(first.data.results || [])]
  let next = first.data.next
  let page = 1
  while (next && page < MAX_BOOK_PAGES) {
    page += 1
    const response = await api.get('/book/', { params: { status: 'active', page_size: 100, ...params, page } })
    results.push(...(response.data.results || []))
    next = response.data.next
  }
  return { data: { ...first.data, results, next: null } }
}

export const getAllBooks = (params = {}) =>
  withFallback(listKey('books-all', params), () => fetchAllBookPages(params), mockBooks).then(normalizeListResponse)

export const getBook = (id) =>
  withFallback(
    `book-${id}`,
    () => api.get(`/book/${id}/`),
    () => findCachedBook(id) || mockBooks.results.find(b => String(b.id) === String(id))
  )

export const getCategories = (params = {}) =>
  withFallback(
    listKey('categories', params),
    () => api.get('/category/', { params: { status: 'active', page_size: 100, ...params } }),
    mockCategories
  ).then(normalizeListResponse)

export const getAuthors = (params = {}) =>
  withFallback(
    listKey('authors', params),
    () => api.get('/author/', { params: { status: 'active', page_size: 100, ...params } }),
    mockAuthors
  ).then(normalizeListResponse)

export const loginUser = (credentials) =>
  api.post('/token/', credentials, { skipAuth: true })

// eslint-disable-next-line no-unused-vars
export const registerUser = ({ password2, ...user }) =>
  api.post('/register/', user, { skipAuth: true })

// Parolni tiklash: emailga 6 xonali kod yuboriladi, keyin kod bilan yangi parol o'rnatiladi
export const forgotPassword = (email) =>
  api.post('/password/forgot/', { email }, { skipAuth: true })

export const resetPassword = ({ email, code, password }) =>
  api.post('/password/reset/', { email, code, password }, { skipAuth: true })

export const getBookReviews = (bookId, params = {}) =>
  api.get('/review/', { params: { book: bookId, page_size: 100, ...params }, skipAuth: true })

export const getMyBookReview = (bookId) =>
  api.get('/review/mine/', { params: { book: bookId } })

const makeReviewFormData = (bookId, review) => {
  const formData = new FormData()
  formData.append('book', bookId)
  formData.append('rating', review.rating)
  formData.append('comment', review.comment)
  if (review.photo) formData.append('photo', review.photo)
  return formData
}

export const createBookReview = (bookId, review) =>
  api.post('/review/', makeReviewFormData(bookId, review))

export const updateBookReview = (reviewId, bookId, review) =>
  api.patch(`/review/${reviewId}/`, makeReviewFormData(bookId, review))

const toOrderItems = (items) => items.map((item) => ({ book_id: item.id, quantity: item.quantity }))

// delivery: { delivery_method, recipient_name, recipient_phone, city, district, street, house, delivery_comment }
// idempotencyKey: qayta bosish/timeout'da bir xil buyurtma ikki marta yaratilmasligi uchun (server sarlavhani qo'llab-quvvatlasa)
export const checkoutOrder = (items, promoCode = '', delivery = {}, { idempotencyKey } = {}) =>
  api.post(
    '/cart/checkout/',
    { items: toOrderItems(items), promo_code: promoCode, ...delivery },
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
  )

// Serverda sessiyani bekor qilish (best-effort). fetch+keepalive: keyingi to'liq reload so'rovni uzib qo'ymaydi.
export const logoutOnServer = () => {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return
  const access = localStorage.getItem('access_token')
  try {
    fetch(`${baseURL}/logout/`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      body: JSON.stringify({ refresh }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  } catch {
    // Chiqish baribir davom etadi.
  }
}

// Savat hisob-kitobi: chegirma, yetkazib berish va to'lov summasi
export const getCartQuote = (items, promoCode = '', deliveryMethod = 'delivery') =>
  api.post('/cart/quote/', { items: toOrderItems(items), promo_code: promoCode, delivery_method: deliveryMethod }, { skipAuth: true })

export const getMyOrders = () =>
  api.get('/order/', { params: { page_size: 100 } })

export const getProfile = () => api.get('/profile/')

export const updateProfile = (data) => api.patch('/profile/', data)

// Audio/PDF havolalari: faqat sotib olgan foydalanuvchiga beriladi (aks holda 403)
export const getBookDigital = (id) => api.get(`/book/${id}/digital/`)

// Qidiruv takliflari: kitoblar va mualliflar (keshsiz, har so'rov yangi)
export const searchSuggestions = async (text) => {
  const [books, authors] = await Promise.all([
    api.get('/book/', { params: { search: text, status: 'active', page_size: 5 } }),
    api.get('/author/', { params: { search: text, status: 'active', page_size: 3 } }),
  ])
  const list = (response) => (Array.isArray(response.data) ? response.data : response.data.results || [])
  return {
    books: list(books).map((b) => ({ type: 'book', id: b.id, name: b.name, author: b.author_name, price: b.price, photo: b.photo })),
    authors: list(authors).map((a) => ({ type: 'author', id: a.id, name: a.full_name, photo: a.photo })),
  }
}
