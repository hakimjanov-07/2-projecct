import { useSyncExternalStore } from 'react'
import { AUTH_EVENT } from './api'

// Kirish holati localStorage'da turadi: 'auth-changed' (shu tab) va 'storage' (boshqa tab) hodisalarida yangilanadi
const subscribe = (callback) => {
  window.addEventListener(AUTH_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(AUTH_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

const getSnapshot = () => {
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

export default function useAuthToken() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
