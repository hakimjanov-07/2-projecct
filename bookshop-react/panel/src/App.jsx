import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isLoggedIn } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Books from './pages/Books'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Promos from './pages/Promos'
import './panel.css'

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn)

  // api.js sessiya yaroqsiz bo'lganda shu hodisani yuboradi
  useEffect(() => {
    const onLogout = () => setAuthed(false)
    window.addEventListener('panel-logout', onLogout)
    return () => window.removeEventListener('panel-logout', onLogout)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login onLogin={() => setAuthed(true)} />} />
        {authed ? (
          <Route element={<Layout onLogout={() => setAuthed(false)} />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="books" element={<Books />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="promos" element={<Promos />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
