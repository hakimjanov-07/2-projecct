import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { clearSession } from '../api'
import { SITE } from '../config/site'
import { LANGUAGES } from '../i18n/translations'
import { getTheme, setTheme } from '../theme'
import { useLang } from '../i18n/LanguageContext'
import CategoryMenu from './CategoryMenu'
import SearchSuggest from './SearchSuggest'
import { useSuggestions } from '../useSuggestions'
import styles from './Navbar.module.css'

const categoryLinks = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.books', to: '/books' },
  { key: 'nav.authors', to: '/authors' },
  { key: 'nav.news', to: '/articles' },
  { key: 'nav.about', to: '/about' },
  { key: 'nav.services', to: '/services' },
]

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17Zm0 2a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13Zm.75 2.5h-1.5v4.7l3.63 2.1l.75-1.3l-2.88-1.66V8Z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.9 4.5c.44 0 .8.36.8.8v2.5c0 .42-.32.78-.75.8l-1.1.08a11.9 11.9 0 0 0 8.35 8.35l.08-1.1a.8.8 0 0 1 .8-.75h2.5c.44 0 .8.36.8.8v2.2c0 .8-.65 1.45-1.45 1.45A15.8 15.8 0 0 1 4.8 6.45A1.45 1.45 0 0 1 6.25 5h.65Z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.2 17.3l-4.2-4.2l1.4-1.4l4.2 4.2l-1.4 1.4Z"/>
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4.5h2l2.2 9.1a1.5 1.5 0 0 0 1.46 1.2h8.7a1.5 1.5 0 0 0 1.46-1.2L20 7H6.4M9 18.5a1.25 1.25 0 1 1 0 2.5a1.25 1.25 0 0 1 0-2.5Zm8 0a1.25 1.25 0 1 1 0 2.5a1.25 1.25 0 0 1 0-2.5Z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className={styles.outlineIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2c1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2ZM12 6.5v13" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.5a3.5 3.5 0 1 1 0-7a3.5 3.5 0 0 1 0 7Zm-6 7.5c.8-2.8 3.3-4.5 6-4.5s5.2 1.7 6 4.5H6Z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.7 3.5a8.3 8.3 0 1 0 5.8 14.2A7.2 7.2 0 0 1 14.7 3.5Z" />
    </svg>
  )
}

function SunIcon() {
  // Markazda to'ldirilgan doira, atrofida 8 ta nur (aniq qalinlikdagi chiziqlar)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path
        d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.35 5.35l1.85 1.85M16.8 16.8l1.85 1.85M5.35 18.65l1.85-1.85M16.8 7.2l1.85-1.85"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { totalItems } = useCart()
  const { favoritesCount } = useFavorites()
  const activeSearch = searchParams.get('search') || ''
  const [query, setQuery] = useState(activeSearch)
  const { lang, setLang, t } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState(getTheme)
  const [langOpen, setLangOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { pathname } = useLocation()
  const profileRef = useRef(null)
  const searchAreaRef = useRef(null)
  const searchInputRef = useRef(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const suggest = useSuggestions(query, searchFocused)
  const langRef = useRef(null)
  const token = localStorage.getItem('access_token')
  const username = localStorage.getItem('username')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(activeSearch)
  }, [activeSearch])

  // Tashqariga bosilganda yoki Escape bosilganda menyu yopiladi
  useEffect(() => {
    if (!menuOpen) return
    const handlePointer = (event) => {
      if (!searchAreaRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  // Qidiruv takliflari: tashqariga bosilganda yopiladi
  useEffect(() => {
    if (!searchFocused) return undefined
    const handlePointer = (event) => {
      if (!searchAreaRef.current?.contains(event.target)) {
        setSearchFocused(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [searchFocused])

  // Til menyusi: tashqariga bosilganda yoki Escape bosilganda yopiladi
  useEffect(() => {
    if (!langOpen) return
    const handlePointer = (event) => {
      if (!langRef.current?.contains(event.target)) setLangOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setLangOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [langOpen])

  // Profil menyusi: tashqariga bosilganda yoki Escape bosilganda yopiladi
  useEffect(() => {
    if (!profileOpen) return
    const handlePointer = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [profileOpen])

  // Takliflar ro'yxati: kitoblar, mualliflar va oxirida "hammasini ko'rish"
  const suggestItems = suggest.active ? [...suggest.books, ...suggest.authors, { type: 'all' }] : []
  const showSuggest = searchFocused && suggest.active

  const closeSuggest = () => {
    setSearchFocused(false)
    setActiveIdx(-1)
    searchInputRef.current?.blur()
  }

  const goSearch = () => {
    const search = query.trim()
    navigate(search ? `/books?search=${encodeURIComponent(search)}` : '/books')
  }

  const pickSuggestion = (item) => {
    closeSuggest()
    if (item.type === 'book') navigate(`/books/${item.id}`)
    else if (item.type === 'author') navigate(`/books?author=${item.id}`)
    else goSearch()
  }

  const onSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      closeSuggest()
    } else if (showSuggest && suggestItems.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      const last = suggestItems.length - 1
      setActiveIdx((current) => {
        if (event.key === 'ArrowDown') return current >= last ? -1 : current + 1
        return current <= -1 ? last : current - 1
      })
    }
  }

  const submitSearch = (event) => {
    event.preventDefault()
    // Klaviatura bilan taklif tanlangan bo'lsa, o'shanga o'tadi
    if (showSuggest && activeIdx >= 0 && suggestItems[activeIdx]) {
      pickSuggestion(suggestItems[activeIdx])
      return
    }
    closeSuggest()
    goSearch()
  }

  const logout = () => {
    clearSession()
    window.location.assign('/')
  }

  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topSpacer} aria-hidden="true" />
          <div className={styles.topMeta}>
            <span className={styles.metaItem}><ClockIcon /> {SITE.workingHours}</span>
            <span className={styles.metaItem}><PhoneIcon /> {SITE.phone}</span>
            <div className={styles.langWrap} ref={langRef}>
              <button
                type="button"
                className={styles.langBtn}
                aria-label={t('nav.language')}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                onClick={() => setLangOpen((open) => !open)}
              >
                {lang.toUpperCase()} <span aria-hidden="true">▾</span>
              </button>
              {langOpen && (
                <ul className={styles.langMenu} role="listbox" aria-label={t('nav.language')}>
                  {LANGUAGES.map((language) => (
                    <li key={language.code} role="option" aria-selected={language.code === lang}>
                      <button
                        type="button"
                        className={`${styles.langOption} ${language.code === lang ? styles.langOptionActive : ''}`}
                        onClick={() => { setLang(language.code); setLangOpen(false) }}
                      >
                        <strong>{language.short}</strong> {language.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className={styles.themeBtn}
              aria-label={theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
              title={theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark'
                setTheme(next)
                setThemeState(next)
              }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mainBar}>
        <div className={styles.mainBarInner}>
          <div className={styles.brandWrap}>
            <NavLink to="/" className={styles.logo}>
              <img src="/logo.svg" alt="" className={styles.logoMark} />
              <span className={styles.logoText}>BOOK.UZ</span>
            </NavLink>
          </div>

          <div className={styles.searchArea} ref={searchAreaRef}>
          <form className={styles.searchForm} role="search" onSubmit={submitSearch}>
            <button
              type="button"
              className={styles.categorySelect}
              aria-expanded={menuOpen}
              onClick={() => { setSearchFocused(false); setMenuOpen((open) => !open) }}
            >
              <span className={styles.menuLines} aria-hidden="true"><span /><span /><span /></span>
              {t('nav.allGenres')}
              <span className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ''}`} aria-hidden="true">▾</span>
            </button>
            <span className={styles.divider} aria-hidden="true" />
            <input
              className={styles.searchInput}
              type="search"
              aria-label={t('nav.searchAria')}
              placeholder={t('nav.searchPlaceholder')}
              value={query}
              ref={searchInputRef}
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggest}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={onSearchKeyDown}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIdx(-1)
                setSearchFocused(true)
              }}
            />
            <button className={styles.searchBtn} type="submit" aria-label={t('nav.search')}>
              <SearchIcon />
            </button>
          </form>
          {showSuggest && !menuOpen && (
            <SearchSuggest
              query={query}
              loading={suggest.loading}
              items={suggestItems}
              activeIndex={activeIdx}
              onPick={pickSuggestion}
              onHover={setActiveIdx}
            />
          )}
          <CategoryMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
          </div>

          <div className={styles.iconBar}>
            <button className={styles.iconButton} type="button" onClick={() => navigate('/cart')}>
              <span className={styles.iconWrap}><CartIcon /></span>
              <span className={styles.iconLabel}>{t('nav.cart')}</span>
              {totalItems > 0 && <span className={styles.cartCount}>{totalItems}</span>}
            </button>

            <button className={styles.iconButton} type="button" onClick={() => navigate('/my-books')}>
              <span className={styles.iconWrap}><BookIcon /></span>
              <span className={styles.iconLabel}>{t('nav.myBooks')}</span>
              {favoritesCount > 0 && <span className={styles.cartCount}>{favoritesCount}</span>}
            </button>

            {token ? (
              <div className={styles.profileWrap} ref={profileRef}>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span className={styles.iconWrap}><UserIcon /></span>
                  <span className={styles.iconLabel}>{username || t('nav.profile')}</span>
                </button>
                {profileOpen && (
                  <div className={styles.profileMenu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.profileItem}
                      onClick={() => { setProfileOpen(false); navigate('/profile') }}
                    >
                      {t('nav.openProfile')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.profileItem}
                      onClick={() => { setProfileOpen(false); navigate('/orders') }}
                    >
                      {t('profile.tabOrders')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.profileItem}
                      onClick={() => { setProfileOpen(false); navigate('/favorites') }}
                    >
                      {t('profile.tabFavorites')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.profileItem} ${styles.profileLogout}`}
                      onClick={logout}
                    >
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className={styles.loginBtn} type="button" onClick={() => navigate('/login')}>{t('nav.login')}</button>
                <button className={styles.registerBtn} type="button" onClick={() => navigate('/register')}>{t('nav.register')}</button>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className={styles.categoryBar} aria-label={t('nav.mainSections')}>
        <div className={styles.categoryInner}>
          {categoryLinks.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `${styles.categoryLink} ${isActive || (item.to === '/services' && pathname.startsWith('/help/')) ? styles.activeCategory : ''}`}
            >
              {t(item.key)}
            </NavLink>
          ))}

        </div>
      </nav>
    </header>
  )
}
