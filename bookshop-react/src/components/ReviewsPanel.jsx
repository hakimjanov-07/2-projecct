import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createBookReview, getBookReviews, getMyBookReview, updateBookReview } from '../api'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import styles from './ReviewsPanel.module.css'

const emptyForm = { rating: '5', comment: '', photo: null }

const toList = (response) => (Array.isArray(response.data) ? response.data : response.data.results || [])

export default function ReviewsPanel({ bookId, onCountChange }) {
  const { t, locale } = useLang()
  const { showToast } = useToast()
  const [reviews, setReviews] = useState([])
  const [mine, setMine] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [hoverStar, setHoverStar] = useState(0) // sichqoncha ustidagi yulduz (faqat mouse)
  const [popStar, setPopStar] = useState(0) // tanlangan yulduz: bir marta "pop"
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const photoRef = useRef(null)
  const isLoggedIn = Boolean(localStorage.getItem('access_token'))
  const returnTo = `/books/${bookId}?tab=reviews`

  const load = useCallback(async () => {
    const response = await getBookReviews(bookId, { page_size: 100 })
    const list = toList(response)
    setReviews(list)
    onCountChange?.(response.data.count ?? list.length)

    if (localStorage.getItem('access_token')) {
      try {
        const own = (await getMyBookReview(bookId)).data
        setMine(own || null)
      } catch {
        setMine(null)
      }
    }
  }, [bookId, onCountChange])

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch(() => active && setError(t('reviews.loadError')))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [load, t])

  const startEditing = () => {
    if (!mine) return
    setForm({ rating: String(mine.rating), comment: mine.comment, photo: null })
    setError('')
    setNotice('')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setForm(emptyForm)
    setError('')
  }

  // Tanlangan rasmni olib tashlash
  const clearPhoto = () => {
    setForm((current) => ({ ...current, photo: null }))
    if (photoRef.current) photoRef.current.value = ''
  }

  const showForm =isLoggedIn && (!mine || editing)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    const data = { rating: Number(form.rating), comment: form.comment.trim(), photo: form.photo }
    try {
      if (mine) {
        await updateBookReview(mine.id, bookId, data)
        showToast(t('reviews.updated'))
      } else {
        await createBookReview(bookId, data)
        showToast(t('reviews.added'))
      }
      setForm(emptyForm)
      setEditing(false)
      if (photoRef.current) photoRef.current.value = ''
      try {
        await load()
      } catch {
        setError(t('reviews.refreshFailed'))
      }
    } catch (requestError) {
      const body = requestError.response?.data
      setError(
        requestError.response?.status === 401
          ? t('reviews.sessionExpired')
          : body?.detail || body?.non_field_errors?.[0] || t('reviews.sendFailed')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 className={styles.title}>{t('reviews.panelTitle')}</h2>
      <p className={styles.subtitle}>{t('reviews.panelSubtitle')}</p>

      {isLoggedIn ? (
        showForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHead}>
            <h3>{editing ? t('reviews.editMine') : t('reviews.newTitle')}</h3>
            {editing && (
              <button type="button" className={styles.cancel} onClick={cancelEditing}>{t('reviews.cancel')}</button>
            )}
          </div>

          <fieldset className={styles.ratingSet}>
            <legend>{t('reviews.rating')}</legend>
            <div className={styles.starPicker} role="radiogroup" aria-label={t('reviews.rateAria')} onPointerLeave={() => setHoverStar(0)}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <label
                  key={rating}
                  className={styles.starOption}
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHoverStar(rating) }}
                >
                  <input
                    type="radio"
                    name="rating"
                    value={rating}
                    checked={Number(form.rating) === rating}
                    onChange={(event) => { setForm({ ...form, rating: event.target.value }); setPopStar(rating); setHoverStar(0) }}
                    aria-label={t('reviews.stars', { n: rating })}
                  />
                  <span
                    className={`${(hoverStar || Number(form.rating)) >= rating ? styles.starOn : ''} ${popStar === rating ? styles.starPop : ''}`}
                    style={hoverStar ? { transitionDelay: `${(rating - 1) * 40}ms` } : undefined}
                    onAnimationEnd={() => setPopStar(0)}
                    aria-hidden="true"
                  >★</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={styles.field}>
            {t('reviews.comment')}
            <textarea
              required
              minLength={3}
              rows={4}
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
              placeholder={t('reviews.commentPlaceholder')}
            />
          </label>

          <div className={styles.field}>
            <span id="review-photo-label">{t('reviews.photo')}</span>
            <div className={styles.fileRow}>
              {/* Standart input yashirin, label tugma vazifasini bajaradi */}
              <input
                ref={photoRef}
                id="review-photo"
                className={styles.fileInput}
                type="file"
                accept="image/*"
                aria-labelledby="review-photo-label"
                onChange={(event) => setForm({ ...form, photo: event.target.files?.[0] || null })}
              />
              <label htmlFor="review-photo" className={styles.fileBtn}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="m21 16-5-5-9 9" />
                </svg>
                {form.photo ? t('reviews.photoChange') : t('reviews.photoChoose')}
              </label>
              {form.photo ? (
                <span className={styles.fileChip}>
                  <span className={styles.fileName} title={form.photo.name}>{form.photo.name}</span>
                  <button type="button" className={styles.fileRemove} aria-label={t('reviews.photoRemove')} title={t('reviews.photoRemove')} onClick={clearPhoto}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </span>
              ) : (
                <span className={styles.fileEmpty}>{t('reviews.photoNone')}</span>
              )}
            </div>
          </div>

          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? t('reviews.sending') : editing ? t('reviews.update') : t('reviews.submit')}
          </button>
        </form>
        )
      ) : (
        <div className={styles.gate}>
          <p>{t('reviews.loginRequired')}</p>
          <div className={styles.gateButtons}>
            <Link to="/login" state={{ from: returnTo }} className={styles.gateLogin}>{t('nav.login')}</Link>
            <Link to="/register" state={{ from: returnTo }} className={styles.gateRegister}>{t('nav.register')}</Link>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {loading ? (
        <p className={styles.muted}>{t('reviews.loading')}</p>
      ) : reviews.length === 0 ? (
        <p className={styles.muted}>{t('reviews.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {reviews.map((review) => (
            <li key={review.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.avatar} aria-hidden="true">
                  {(review.username || '?').charAt(0).toUpperCase()}
                </span>
                <div className={styles.who}>
                  <strong>
                    {review.username || t('reviews.reader')}
                    {mine && review.id === mine.id && <em className={styles.you}>{t('reviews.you')}</em>}
                  </strong>
                  <time dateTime={review.created_on}>{new Date(review.created_on).toLocaleDateString(locale)}</time>
                </div>
                <span className={styles.stars} aria-label={`${review.rating} / 5`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= review.rating ? styles.starOn : styles.starOff}>★</span>
                  ))}
                </span>
                {mine && review.id === mine.id && (
                  <button
                    type="button"
                    className={styles.editBtn}
                    aria-label={t('reviews.edit')}
                    title={t('reviews.edit')}
                    onClick={startEditing}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3Zm9-13 4 4" />
                    </svg>
                  </button>
                )}
              </div>
              <p>{review.comment}</p>
              {review.photo_url && (
                <img
                  className={styles.photo}
                  src={review.photo_url}
                  alt={t('reviews.photoAlt', { name: review.username || t('reviews.reader') })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
