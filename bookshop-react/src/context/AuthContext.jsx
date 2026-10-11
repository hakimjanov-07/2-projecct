import { createContext, useContext, useState, useEffect } from 'react'
import { loginUser, registerUser } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || null)
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user_info')
      if (savedUser) return JSON.parse(savedUser)
      const username = localStorage.getItem('username')
      return username ? { username } : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (token) {
      localStorage.setItem('access_token', token)
    } else {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_info')
      localStorage.removeItem('username')
    }
  }, [token])

  const login = async (credentials) => {
    const res = await loginUser(credentials)
    const { access, refresh, user: userData } = res.data
    localStorage.setItem('access_token', access)
    if (refresh) localStorage.setItem('refresh_token', refresh)
    if (userData) {
      localStorage.setItem('user_info', JSON.stringify(userData))
      localStorage.setItem('username', userData.username)
      setUser(userData)
    }
    setToken(access)
    return res.data
  }

  const register = async (userData) => {
    const res = await registerUser(userData)
    const { access, refresh, user: registeredUser } = res.data
    if (access) {
      localStorage.setItem('access_token', access)
      if (refresh) localStorage.setItem('refresh_token', refresh)
      if (registeredUser) {
        localStorage.setItem('user_info', JSON.stringify(registeredUser))
        localStorage.setItem('username', registeredUser.username)
        setUser(registeredUser)
      }
      setToken(access)
    }
    return res.data
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('username')
  }

  const isAuthenticated = Boolean(token)

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
