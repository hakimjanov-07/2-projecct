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

export const clearSession = () => {
  ;['access_token', 'refresh_token', 'username', 'user_info'].forEach((key) => localStorage.removeItem(key))
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

const withFallback = (key, requestFactory, mockData) =>
  requestFactory()
    .then((response) => {
      writeCache(key, response.data)
      return response
    })
    .catch((error) => {
      const fallbackData = readCache(key)
      if (fallbackData) {
        console.warn('Using cached API data:', key)
        return Promise.resolve({ data: fallbackData })
      }

      if (!USE_MOCK_API) {
        return Promise.reject(error)
      }

      console.warn('Using mock API data for development:', error.message)
      return Promise.resolve({ data: mockData })
    })


const normalizeListResponse = (response) => {
  if (Array.isArray(response.data)) {
    return { ...response, data: { results: response.data } }
  }
  return response
}

export const getBooks = (params = {}) =>
  withFallback(
    `books-${params.page_size || 'default'}`,
    () => api.get('/book/', { params: { status: 'active', ...params } }),
    mockBooks
  ).then(normalizeListResponse)

export const getBook = (id) =>
  withFallback(
    `book-${id}`,
    () => api.get(`/book/${id}/`),
    readCache('books-100')?.results?.find(b => String(b.id) === String(id)) ||
      readCache('books-12')?.results?.find(b => String(b.id) === String(id)) ||
      mockBooks.results.find(b => String(b.id) === String(id))
  )

export const getCategories = (params = {}) =>
  withFallback(
    'categories',
    () => api.get('/category/', { params: { status: 'active', page_size: 100, ...params } }),
    mockCategories
  ).then(normalizeListResponse)

export const getAuthors = (params = {}) =>
  withFallback(
    'authors',
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

export const checkoutOrder = (items, promoCode = '') =>
  api.post('/cart/checkout/', { items: toOrderItems(items), promo_code: promoCode })

// Savat hisob-kitobi: chegirma, yetkazib berish va to'lov summasi
export const getCartQuote = (items, promoCode = '') =>
  api.post('/cart/quote/', { items: toOrderItems(items), promo_code: promoCode }, { skipAuth: true })

export const getMyOrders = () =>
  api.get('/order/', { params: { page_size: 100 } })

export const getProfile = () => api.get('/profile/')

export const updateProfile = (data) => api.patch('/profile/', data)
