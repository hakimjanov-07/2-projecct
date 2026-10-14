import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { clearSession, getUsername } from '../auth'
import { getTheme, setTheme } from '../theme'
import NavIcon from './NavIcons'

const NAV = [
  { to: '/', label: 'Boshqaruv', icon: 'dashboard', end: true },
  { to: '/orders', label: 'Buyurtmalar', icon: 'orders' },
  { to: '/books', label: 'Kitoblar', icon: 'books' },
  { to: '/users', label: 'Foydalanuvchilar', icon: 'users' },
  { to: '/promos', label: 'Promo kodlar', icon: 'promos' },
]

// Katalogni (kitob, muallif, janr) to'liq tahrirlash Django adminda qoladi
const DJANGO_ADMIN = import.meta.env.VITE_DJANGO_ADMIN_URL || 'http://127.0.0.1:8000/admin/'

export default function Layout({ onLogout }) {
  const [theme, setThemeState] = useState(getTheme)
  const [open, setOpen] = useState(false)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  const logout = () => {
    clearSession()
    onLogout()
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <img src="/logo.svg" alt="" className="brand-mark" />
          <div>
            <strong>BOOK.UZ</strong>
            <small>Admin panel</small>
          </div>
        </div>

        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <a className="nav-link nav-extra" href={DJANGO_ADMIN} target="_blank" rel="noreferrer">
          <NavIcon name="settings" />
          Katalogni tahrirlash
        </a>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost menu-btn" aria-label="Menyu" onClick={() => setOpen((v) => !v)}>☰</button>
          <span className="topbar-spacer" />
          <button type="button" className="btn btn-ghost" onClick={toggleTheme} title={theme === 'dark' ? "Yorug' rejim" : "Qorong'i rejim"}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <span className="who">{getUsername()}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>Chiqish</button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
