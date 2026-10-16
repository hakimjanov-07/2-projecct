import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { getNewOrdersCount } from '../api'
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

const POLL_MS = 25000

// Yangi (tasdiqlangan) buyurtmalar soni: ochilganda, har 25 soniyada va holat o'zgarganda yangilanadi
function useNewOrders() {
  const [count, setCount] = useState(0)
  const [pop, setPop] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    let stopped = false
    let timer = null

    const load = async () => {
      try {
        const data = await getNewOrdersCount()
        if (stopped) return
        if (data.count > prev.current) setPop((n) => n + 1)
        prev.current = data.count
        setCount(data.count)
      } catch (err) {
        // Token yaroqsiz: yangilashni to'xtatamiz (api.js login'ga qaytaradi)
        if ([401, 403].includes(err.response?.status)) stop()
      }
    }
    const start = () => {
      if (timer || stopped) return
      load()
      timer = setInterval(load, POLL_MS)
    }
    const pause = () => {
      clearInterval(timer)
      timer = null
    }
    const stop = () => {
      stopped = true
      pause()
    }
    const onVisible = () => (document.visibilityState === 'visible' ? start() : pause())
    const onChanged = () => !stopped && load()

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('panel-orders-changed', onChanged)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('panel-orders-changed', onChanged)
    }
  }, [])

  return { count, pop }
}

export default function Layout({ onLogout }) {
  const [theme, setThemeState] = useState(getTheme)
  const [open, setOpen] = useState(false)
  const { count: newOrders, pop } = useNewOrders()

  useEffect(() => {
    const base = 'BOOK.UZ Admin'
    document.title = newOrders > 0 ? `(${newOrders}) ${base}` : base
  }, [newOrders])

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
              {item.to === '/orders' && newOrders > 0 && (
                <span key={pop} className="nav-badge" aria-label={`${newOrders} ta yangi buyurtma`}>
                  {newOrders > 99 ? '99+' : newOrders}
                </span>
              )}
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
          <button type="button" className="btn btn-ghost menu-btn" aria-label="Menyu" onClick={() => setOpen((v) => !v)}><span aria-hidden="true">☰</span></button>
          <span className="topbar-spacer" />
          <button type="button" className="btn btn-ghost" onClick={toggleTheme} aria-pressed={theme === 'dark'} aria-label="Qorong'i rejim" title={theme === 'dark' ? "Yorug' rejim" : "Qorong'i rejim"}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
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
