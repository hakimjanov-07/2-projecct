import { useState } from 'react'
import { login } from '../api'
import { saveSession } from '../auth'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await login(username.trim(), password)
      saveSession(res.data)
      onLogin()
    } catch (err) {
      setError(err.response?.status === 429
        ? "Juda ko'p urinish. Bir daqiqadan keyin qayta urinib ko'ring."
        : err.response?.data?.detail || "Server bilan bog'lanib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand brand-login">
          <img src="/logo.svg" alt="" className="brand-mark" />
          <div>
            <strong>BOOK.UZ</strong>
            <small>Admin panel</small>
          </div>
        </div>

        <h1>Kirish</h1>
        <p className="muted">Faqat ruxsat berilgan administratorlar uchun.</p>

        <label>
          Login
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>
          Parol
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error && <p className="alert" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Tekshirilmoqda…' : 'Kirish'}</button>
      </form>
    </div>
  )
}
