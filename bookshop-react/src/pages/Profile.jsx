import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearSession, getMyOrders, getProfile, updateProfile } from '../api'
import { useFavorites } from '../context/FavoritesContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './Profile.module.css'

const PROFILE_KEY = 'bookshop-profile'

const EMPTY_PROFILE = { fullName: '', email: '', phone: '', address: '', bio: '' }

// Server javobi (full_name) <-> forma maydonlari (fullName)
const fromServer = (data) => ({
  fullName: data.full_name || '',
  email: data.email || '',
  phone: data.phone || '',
  address: data.address || '',
  bio: data.bio || '',
})

const toServer = (profile) => ({
  full_name: profile.fullName,
  email: profile.email,
  phone: profile.phone,
  address: profile.address,
  bio: profile.bio,
})

// Eski versiyada profil faqat brauzerda saqlangan edi: bir marta serverga ko'chiramiz
const readLegacyProfile = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')
    if (!saved) return null
    const legacy = { ...EMPTY_PROFILE, ...saved, email: '' }
    return Object.values(legacy).some(Boolean) ? legacy : null
  } catch {
    return null
  }
}

export default function Profile() {
  const { t, locale } = useLang()
  const navigate = useNavigate()
  const { favoriteIds } = useFavorites()
  const { showToast } = useToast()
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE, fullName: localStorage.getItem('username') || '' })
  const [profileError, setProfileError] = useState('')
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState([])
  const [saved, setSaved] = useState(false)

  const isLoggedIn = Boolean(localStorage.getItem('access_token'))
  const money = (value) => `${Number(value || 0).toLocaleString(locale)} ${t('currency')}`

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/profile' } })
      return
    }

    getProfile()
      .then(async (response) => {
        let data = fromServer(response.data)
        const legacy = readLegacyProfile()
        if (legacy && !data.fullName && !data.phone && !data.address && !data.bio) {
          try {
            const migrated = await updateProfile(toServer({ ...legacy, email: data.email }))
            data = fromServer(migrated.data)
          } catch {
            data = { ...data, ...legacy, email: data.email }
          }
        }
        try { localStorage.removeItem(PROFILE_KEY) } catch { /* xotira yo'q */ }
        if (data.email) localStorage.setItem('user_email', data.email)
        setProfile(data)
      })
      .catch((error) => {
        if (error.response?.status === 401) navigate('/login', { state: { from: '/profile' } })
        else setProfileError('loadError')
      })

    getMyOrders()
      .then((response) => setOrders(response.data.results || response.data))
      .catch((error) => {
        if (error.response?.status === 401) navigate('/login', { state: { from: '/profile' } })
      })
  }, [isLoggedIn, navigate])

  const stats = useMemo(() => ({
    orders: orders.length,
    books: orders.reduce((sum, order) => sum + (order.total_items || 0), 0),
    spent: orders.reduce((sum, order) => sum + (order.total_price || 0), 0),
  }), [orders])

  const handleChange = (event) => {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setProfileError('')
    try {
      const response = await updateProfile(toServer(profile))
      const data = fromServer(response.data)
      setProfile(data)
      if (data.email) localStorage.setItem('user_email', data.email)
      setSaved(true)
      showToast(t('toast.profileSaved'))
      setTimeout(() => setSaved(false), 1800)
    } catch (error) {
      setProfileError(error.response?.data?.email ? 'emailTaken' : 'saveError')
    } finally {
      setSaving(false)
    }
  }

  const logout = () => {
    clearSession()
    window.location.assign('/')
  }

  const displayName = profile.fullName || localStorage.getItem('username') || ''
  const initial = (displayName.charAt(0) || '?').toUpperCase()

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <aside className={styles.sidebar} data-reveal>
          <div className={styles.avatar} aria-hidden="true">{initial}</div>
          <h1 className={styles.name}>{displayName}</h1>
          {profile.email && <p className={styles.email}>{profile.email}</p>}
          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

          <dl className={styles.facts}>
            <div>
              <dt>{t('profile.phone')}</dt>
              <dd>{profile.phone || t('profile.noInfo')}</dd>
            </div>
            <div>
              <dt>{t('profile.address')}</dt>
              <dd>{profile.address || t('profile.noInfo')}</dd>
            </div>
          </dl>

          <button type="button" className={styles.logout} onClick={logout}>{t('nav.logout')}</button>
        </aside>

        <section className={styles.content}>
          <div className={styles.stats}>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statOrders')}</span>
              <strong>{stats.orders}</strong>
            </div>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statBooks')}</span>
              <strong>{stats.books}</strong>
            </div>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statSpent')}</span>
              <strong>{money(stats.spent)}</strong>
            </div>
            <div className={styles.stat} data-reveal>
              <span>{t('profile.statFavorites')}</span>
              <strong>{favoriteIds.length}</strong>
            </div>
          </div>

          <div className={styles.panel} data-reveal>
            <form className={styles.form} onSubmit={handleSave}>
              <h2>{t('profile.formTitle')}</h2>
              <p className={styles.hint}>{t('profile.formHint')}</p>

              <div className={styles.grid}>
                <label>
                  {t('profile.fullName')}
                  <input name="fullName" value={profile.fullName} onChange={handleChange} placeholder={t('profile.namePlaceholder')} />
                </label>
                <label>
                  {t('profile.email')}
                  <input type="email" name="email" value={profile.email} onChange={handleChange} />
                </label>
                <label>
                  {t('profile.phone')}
                  <input name="phone" value={profile.phone} onChange={handleChange} />
                </label>
                <label>
                  {t('profile.address')}
                  <input name="address" value={profile.address} onChange={handleChange} />
                </label>
                <label className={styles.wide}>
                  {t('profile.bio')}
                  <textarea name="bio" rows="4" value={profile.bio} onChange={handleChange} />
                </label>
              </div>

              {profileError && <p className={styles.errorBox}>{t(`profile.${profileError}`)}</p>}

              <button className={styles.saveBtn} type="submit" disabled={saving}>
                {saved ? t('profile.saved') : t('profile.save')}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
