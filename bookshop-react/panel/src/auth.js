// Panel sessiyasi: saytnikidan alohida kalitlarda saqlanadi
const ACCESS = 'panel_access'
const REFRESH = 'panel_refresh'
const NAME = 'panel_username'

export const getAccess = () => localStorage.getItem(ACCESS)
export const getRefresh = () => localStorage.getItem(REFRESH)
export const getUsername = () => localStorage.getItem(NAME) || ''
export const isLoggedIn = () => Boolean(getAccess())

export const saveSession = ({ access, refresh, user }) => {
  localStorage.setItem(ACCESS, access)
  localStorage.setItem(REFRESH, refresh)
  localStorage.setItem(NAME, user?.username || '')
}

export const setAccess = (access) => localStorage.setItem(ACCESS, access)

export const clearSession = () => {
  ;[ACCESS, REFRESH, NAME].forEach((key) => localStorage.removeItem(key))
}
