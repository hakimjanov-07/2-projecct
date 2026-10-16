import axios from 'axios'
import { clearSession, getAccess, getRefresh, setAccess } from './auth'

const baseURL = import.meta.env.PROD ? (import.meta.env.VITE_API_URL || '/api') : '/api'

const api = axios.create({ baseURL, timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = getAccess()
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Access token eskirsa, refresh bilan bir marta yangilab qayta urinadi
let refreshing = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const refresh = getRefresh()
    const status = error.response?.status

    if (status === 401 && original && !original._retry && !original.skipAuth && refresh) {
      original._retry = true
      try {
        refreshing ??= axios.post(`${baseURL}/token/refresh/`, { refresh }).finally(() => { refreshing = null })
        const res = await refreshing
        setAccess(res.data.access)
        original.headers.Authorization = `Bearer ${res.data.access}`
        return api(original)
      } catch {
        // refresh ham eskirgan: pastda sessiya tozalanadi
      }
    }

    // Sessiya yaroqsiz yoki admin huquqi yo'q: login sahifasiga
    if ((status === 401 || status === 403) && !original?.skipAuth) {
      clearSession()
      window.dispatchEvent(new Event('panel-logout'))
    }
    return Promise.reject(error)
  }
)

export const login = (username, password) =>
  api.post('/panel/login/', { username, password }, { skipAuth: true })

export const getSummary = (days) => api.get('/panel/summary/', { params: { days } }).then((r) => r.data)
export const getOrders = (params) => api.get('/panel/orders/', { params }).then((r) => r.data)
export const getNewOrdersCount = () => api.get('/panel/orders/new-count/').then((r) => r.data)
export const getOrder =(id) => api.get(`/panel/orders/${id}/`).then((r) => r.data)
export const setOrderStatus = (id, status) => api.patch(`/panel/orders/${id}/`, { status }).then((r) => r.data)
export const getBooks = (params) => api.get('/panel/books/', { params }).then((r) => r.data)
export const updateBook = (id, data) => api.patch(`/panel/books/${id}/`, data).then((r) => r.data)
export const getUsers = (params) => api.get('/panel/users/', { params }).then((r) => r.data)
export const getUser = (id) => api.get(`/panel/users/${id}/`).then((r) => r.data)

export const getPromos = (params) => api.get('/panel/promos/', { params }).then((r) => r.data)
export const createPromo = (data) => api.post('/panel/promos/', data).then((r) => r.data)
export const updatePromo = (id, data) => api.patch(`/panel/promos/${id}/`, data).then((r) => r.data)
export const deletePromo = (id) => api.delete(`/panel/promos/${id}/`)

// CSV (Excel) yuklab olish: token kerak bo'lgani uchun fayl so'rov bilan olinib, brauzerga saqlatiladi
export const downloadCsv = async (kind, params = {}) => {
  const response = await api.get(`/panel/export/${kind}/`, { params, responseType: 'blob' })
  const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '')
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : `${kind}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
