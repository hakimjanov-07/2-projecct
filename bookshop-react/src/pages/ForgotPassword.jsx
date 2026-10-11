import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../api'
import PasswordInput from '../components/PasswordInput'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import authStyles from './Auth.module.css'
import styles from './ForgotPassword.module.css'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60

// 6 ta katakli tasdiqlash kodi (raqam yozilganda keyingisiga o'tadi, bo'shatishda orqaga qaytadi, nusxa qo'yish mumkin)
function CodeInput({ value, onChange, label }) {
  const refs = useRef([])
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] || '')

  const setDigit = (index, digit) => {
    const next = digits.slice()
    next[index] = digit
    onChange(next.join(''))
  }

  const handleChange = (index, event) => {
    const typed = event.target.value.replace(/\D/g, '')
    if (!typed) {
      setDigit(index, '')
      return
    }
    // Bir nechta raqam kirsa (masalan, avtomatik to'ldirish), keyingi kataklarga taqsimlanadi
    const next = digits.slice()
    typed.slice(0, CODE_LENGTH - index).split('').forEach((digit, offset) => { next[index + offset] = digit })
    onChange(next.join(''))
    refs.current[Math.min(index + typed.length, CODE_LENGTH - 1)]?.focus()
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
  }

  return (
    <div className={styles.code} role="group" aria-label={label} onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => { refs.current[index] = element }}
          className={styles.codeBox}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={CODE_LENGTH}
          aria-label={`${label} ${index + 1}`}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  )
}

export default function ForgotPassword() {
  const { t } = useLang()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Qayta yuborish uchun orqaga sanash
  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const describeError = (requestError, fallback) => {
    if (requestError.response?.status === 429) return t('forgot.tooMany')
    const data = requestError.response?.data
    return data?.email?.[0] || data?.code || data?.password?.[0] || data?.detail || fallback
  }

  const sendCode = async (event) => {
    event?.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const response = await forgotPassword(email.trim())
      setSecondsLeft(response.data?.resend_after || RESEND_SECONDS)
      setStep('reset')
      setCode('')
      showToast(t('toast.codeSent', { email: email.trim() }), { icon: '✉' })
    } catch (requestError) {
      setError(describeError(requestError, t('forgot.genericError')))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setError('')
    setNotice('')
    try {
      const response = await forgotPassword(email.trim())
      setSecondsLeft(response.data?.resend_after || RESEND_SECONDS)
      setCode('')
      showToast(t('toast.codeSent', { email: email.trim() }), { icon: '✉' })
    } catch (requestError) {
      setError(describeError(requestError, t('forgot.genericError')))
    }
  }

  const submitReset = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (code.length < CODE_LENGTH) {
      setError(t('forgot.codeIncomplete'))
      return
    }
    if (password !== password2) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await resetPassword({ email: email.trim(), code, password })
      showToast(t('toast.passwordUpdated'))
      navigate('/login')
    } catch (requestError) {
      setError(describeError(requestError, t('forgot.genericError')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={authStyles.page}>
      <section className={authStyles.card}>
        <p className={authStyles.eyebrow}>{t('auth.brand')}</p>

        {step === 'email' ? (
          <>
            <h1>{t('forgot.title')}</h1>
            <p className={authStyles.subtitle}>{t('forgot.subtitle')}</p>

            <form className={authStyles.form} onSubmit={sendCode}>
              <label>
                {t('auth.email')}
                <input
                  required
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {error && <p className={authStyles.error} role="alert">{error}</p>}
              <button type="submit" className={authStyles.submit} disabled={loading}>
                {loading ? t('forgot.sending') : t('forgot.sendCode')}
              </button>
              <p className={authStyles.switch}><Link to="/login">{t('forgot.backToLogin')}</Link></p>
            </form>
          </>
        ) : (
          <>
            <h1>{t('forgot.codeTitle')}</h1>
            <p className={authStyles.subtitle}>
              {t('forgot.codeSent', { email })}
            </p>

            <form className={authStyles.form} onSubmit={submitReset}>
              <div className={styles.codeField}>
                <span>{t('forgot.codeLabel')}</span>
                <CodeInput value={code} onChange={setCode} label={t('forgot.codeLabel')} />
              </div>

              <label>
                {t('forgot.newPassword')}
                <PasswordInput
                  required
                  minLength="6"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                {t('forgot.confirmNew')}
                <PasswordInput
                  required
                  minLength="6"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(event) => setPassword2(event.target.value)}
                />
              </label>

              {error && <p className={authStyles.error} role="alert">{error}</p>}
              {notice && <p className={styles.notice} role="status">{notice}</p>}

              <button type="submit" className={authStyles.submit} disabled={loading}>
                {loading ? t('forgot.resetting') : t('forgot.resetBtn')}
              </button>

              <div className={styles.links}>
                {secondsLeft > 0 ? (
                  <span className={styles.timer}>{t('forgot.resendIn', { s: secondsLeft })}</span>
                ) : (
                  <button type="button" className={styles.linkBtn} onClick={resend}>{t('forgot.resend')}</button>
                )}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => { setStep('email'); setError(''); setNotice('') }}
                >
                  {t('forgot.changeEmail')}
                </button>
              </div>
              <p className={authStyles.switch}><Link to="/login">{t('forgot.backToLogin')}</Link></p>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
