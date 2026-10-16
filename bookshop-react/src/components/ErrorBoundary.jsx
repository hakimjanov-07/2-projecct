import { Component } from 'react'
import { useLang } from '../i18n/LanguageContext'
import styles from './ErrorBoundary.module.css'

// Qattiq yozilgan zaxira matn: til konteksti yoki tarjima ishlamay qolsa ham sahifa matnsiz qolmasin
const FALLBACK = {
  title: 'Nimadir xato ketdi',
  text: "Sahifani ko'rsatishda kutilmagan xatolik yuz berdi. Sahifani yangilab ko'ring yoki bosh sahifaga qayting.",
  reload: 'Sahifani yangilash',
  home: 'Bosh sahifaga',
}

// useLang kontekst yo'q bo'lsa xato beradi; xato sahifasi o'zi yiqilmasligi uchun ushlab olinadi
function useSafeT() {
  try {
    return useLang().t
  } catch {
    return null
  }
}

function ErrorFallback() {
  const t = useSafeT()
  const text = (name) => {
    try {
      const key = `error.${name}`
      const value = t?.(key)
      return value && value !== key ? value : FALLBACK[name]
    } catch {
      return FALLBACK[name]
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.box} role="alert">
        <p className={styles.icon} aria-hidden="true">!</p>
        <h1 className={styles.title}>{text('title')}</h1>
        <p className={styles.text}>{text('text')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            {text('reload')}
          </button>
          {/* Oddiy havola: to'liq qayta yuklanadi, buzilgan holat butunlay tozalanadi */}
          <a href="/" className={styles.secondary}>{text('home')}</a>
        </div>
      </div>
    </main>
  )
}

// Sahifa render paytida kutilmagan xato bersa oppoq ekran o'rniga xato sahifasi ko'rsatiladi.
// resetKey (marshrut kaliti) o'zgarganda xato holati tozalanadi, ya'ni boshqa sahifaga o'tilsa yana ishlaydi.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.warn('Sahifada kutilmagan xato:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children
  }
}
