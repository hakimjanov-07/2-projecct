import { useState } from 'react'
import { SITE } from '../config/site'
import { REGIONS } from '../config/regions'
import { useLang } from '../i18n/LanguageContext'
import { formatPhone, isPhoneComplete } from './deliveryForm'
import LocationMap from './LocationMap'
import Modal from './Modal'
import styles from './DeliveryModals.module.css'

const STORE_CENTER = [SITE.store.lat, SITE.store.lng]

// Yetkazib berish manzili formasi
export default function DeliveryModal({ initial, onConfirm, onClose }) {
  const { t, lang } = useLang()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [geoMessage, setGeoMessage] = useState('')

  const hasPoint = form.delivery_lat != null && form.delivery_lng != null
  const point = hasPoint ? [form.delivery_lat, form.delivery_lng] : null
  const pick = (lat, lng) => {
    setGeoMessage('')
    setForm((prev) => ({ ...prev, delivery_lat: lat, delivery_lng: lng }))
  }
  const clearPoint = () => setForm((prev) => ({ ...prev, delivery_lat: null, delivery_lng: null }))

  // Joylashuv ixtiyoriy: rad etilsa yoki mavjud bo'lmasa, faqat xabar ko'rsatiladi
  const locate = () => {
    if (!navigator.geolocation) {
      setGeoMessage(t('ship.geoUnavailable'))
      return
    }
    setGeoMessage(t('ship.geoLoading'))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pick(+coords.latitude.toFixed(6), +coords.longitude.toFixed(6)),
      (error) => setGeoMessage(error.code === 1 ? t('ship.geoDenied') : t('ship.geoUnavailable')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const submit = (event) => {
    event.preventDefault()
    const next = {}
    if (form.recipient_name.trim().length < 2) next.recipient_name = t('ship.errName')
    if (!isPhoneComplete(form.recipient_phone)) next.recipient_phone = t('ship.errPhone')
    if (!form.city) next.city = t('ship.errRegion')
    if (!form.street.trim()) next.street = t('ship.errStreet')
    setErrors(next)
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    onConfirm({
      recipient_name: form.recipient_name.trim(),
      recipient_phone: form.recipient_phone,
      city: form.city,
      district: form.district.trim(),
      street: form.street.trim(),
      house: form.house.trim(),
      delivery_comment: form.delivery_comment.trim(),
      delivery_lat: form.delivery_lat,
      delivery_lng: form.delivery_lng,
    })
  }

  const field = (key, label, input) => (
    <label className={`${styles.field} ${errors[key] ? styles.invalid : ''}`}>
      {label}
      {input}
      {errors[key] && <span className={styles.err}>{errors[key]}</span>}
    </label>
  )

  return (
    <Modal title={t('ship.title')} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          {field('recipient_name', t('ship.name'), (
            <input
              value={form.recipient_name}
              maxLength={150}
              autoComplete="name"
              aria-invalid={Boolean(errors.recipient_name)}
              data-autofocus
              onChange={(event) => set('recipient_name', event.target.value)}
            />
          ))}
          {field('recipient_phone', t('ship.phone'), (
            <input
              value={form.recipient_phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              aria-invalid={Boolean(errors.recipient_phone)}
              onChange={(event) => set('recipient_phone', formatPhone(event.target.value))}
            />
          ))}
        </div>

        <div className={styles.grid}>
          {field('city', t('ship.region'), (
            <select value={form.city} aria-invalid={Boolean(errors.city)} autoComplete="address-level1" onChange={(event) => set('city', event.target.value)}>
              <option value="">{t('ship.regionPlaceholder')}</option>
              {REGIONS.map((region) => <option key={region.uz} value={region.uz}>{region[lang] || region.uz}</option>)}
            </select>
          ))}
          {field('district', t('ship.district'), (
            <input value={form.district} maxLength={100} autoComplete="address-level2" onChange={(event) => set('district', event.target.value)} />
          ))}
        </div>

        <div className={styles.grid}>
          {field('street', t('ship.street'), (
            <input
              value={form.street}
              maxLength={200}
              autoComplete="street-address"
              aria-invalid={Boolean(errors.street)}
              onChange={(event) => set('street', event.target.value)}
            />
          ))}
          {field('house', t('ship.house'), (
            <input value={form.house} maxLength={50} onChange={(event) => set('house', event.target.value)} />
          ))}
        </div>

        {field('delivery_comment', t('ship.comment'), (
          <textarea
            value={form.delivery_comment}
            maxLength={300}
            placeholder={t('ship.commentPlaceholder')}
            onChange={(event) => set('delivery_comment', event.target.value)}
          />
        ))}

        <div className={styles.mapBlock}>
          <div className={styles.mapHead}>
            <span className={styles.legend}>{t('ship.mapTitle')}</span>
            <div className={styles.mapTools}>
              <button type="button" className={styles.link} onClick={locate}>{t('ship.myLocation')}</button>
              {hasPoint && <button type="button" className={styles.link} onClick={clearPoint}>{t('ship.clearPoint')}</button>}
            </div>
          </div>
          <LocationMap center={point || STORE_CENTER} marker={point} zoom={point ? 16 : 12} onPick={pick} label={t('ship.mapTitle')} />
          <p className={styles.mapHint} role="status">
            {geoMessage || (hasPoint ? `${t('ship.pointSet')}: ${form.delivery_lat}, ${form.delivery_lng}` : t('ship.mapHint'))}
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>{t('modal.cancel')}</button>
          <button type="submit" className={styles.primary}>{t('ship.save')}</button>
        </div>
      </form>
    </Modal>
  )
}
