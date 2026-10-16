import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser, notifyAuthChanged, registerUser } from '../api'
import PasswordInput from '../components/PasswordInput'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import styles from './Auth.module.css'

export function Login() {
  const { t } = useLang()
  useDocumentTitle(t('title.login'))
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await loginUser(form)
      const data = response.data
      localStorage.setItem('access_token', data.access)
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      localStorage.setItem('username', data.user?.username || form.username)
      notifyAuthChanged()
      showToast(t('toast.welcome', { name: data.user?.username || form.username }))
      navigate(location.state?.from || '/')
    } catch (requestError) {
      setError(requestError.response?.status === 429 ? t('auth.tooManyAttempts') : requestError.response?.data?.detail || t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form className={styles.form} onSubmit={submit}>
        <label>{t('auth.usernameOrEmail')}<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>{t('auth.password')}<PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <Link to="/forgot-password" className={styles.forgot}>{t('auth.forgotLink')}</Link>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? t('auth.loggingIn') : t('auth.loginTitle')}
        </button>
        <p className={styles.switch}>{t('auth.noAccount')}<Link to="/register">{t('auth.registerTitle')}</Link></p>
      </form>
    </AuthLayout>
  )
}

export function Register() {
  const { t } = useLang()
  useDocumentTitle(t('title.register'))
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (form.password !== form.password2) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await registerUser(form)
      showToast(t('toast.registered'))
      navigate('/login', { state: { registered: true, from: location.state?.from } })
    } catch (requestError) {
      const data = requestError.response?.data
      setError(
        requestError.response?.status === 429 ? t('auth.tooManyAttempts') :
        data?.detail || data?.error || data?.username?.[0] || data?.email?.[0] ||
        data?.password?.[0] || t('auth.registerFailed')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <form className={styles.form} onSubmit={submit}>
        <label>{t('auth.username')}<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>{t('auth.email')}<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>{t('auth.password')}<PasswordInput required minLength="6" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <label>{t('auth.confirmPassword')}<PasswordInput required minLength="6" autoComplete="new-password" value={form.password2} onChange={(e) => setForm({ ...form, password2: e.target.value })} /></label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.submitArea}>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? t('auth.creating') : t('auth.registerTitle')}
          </button>
        </div>
        <p className={styles.switch}>{t('auth.haveAccount')}<Link to="/login" state={{ from: location.state?.from }}>{t('auth.loginTitle')}</Link></p>
      </form>
    </AuthLayout>
  )
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>BOOK.UZ</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children}
      </section>
    </main>
  )
}
