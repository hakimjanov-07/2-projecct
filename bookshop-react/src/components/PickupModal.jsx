import { useMemo, useState } from 'react'
import { SITE } from '../config/site'
import { useLang } from '../i18n/LanguageContext'
import { formatPhone, isPhoneComplete } from './deliveryForm'
import LocationMap from './LocationMap'
import Modal from './Modal'
import styles from './DeliveryModals.module.css'

// Olib ketish: do'kon xaritada (OpenStreetMap, kalit talab qilmaydi) va aloqa ma'lumotlari
export default function PickupModal({ initial, onConfirm, onClose }) {
  const { t, lang } = useLang()
  const { lat, lng, phones, address } = SITE.store
  const [name, setName] = useState(initial.recipient_name)
  const [phone, setPhone] = useState(initial.recipient_phone)
  const [phoneError, setPhoneError] = useState(false)

  const point = useMemo(() => [lat, lng], [lat, lng])
  const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

  const submit = (event) => {
    event.preventDefault()
    if (phone && !isPhoneComplete(phone)) {
      setPhoneError(true)
      return
    }
    onConfirm({ recipient_name: name.trim(), recipient_phone: phone })
  }

  return (
    <Modal title={t('pickup.title')} onClose={onClose}>
      <p className={styles.note}>{t('pickup.free')}</p>

      <LocationMap center={point} marker={point} zoom={16} label={t('pickup.mapTitle')} />
      <a className={styles.mapLink} href={mapUrl} target="_blank" rel="noopener noreferrer">{t('pickup.openMap')} ↗</a>

      <dl className={styles.info}>
        <div><dt>{t('pickup.address')}</dt><dd>{address[lang] || address.uz}</dd></div>
        <div>
          <dt>{t('pickup.phones')}</dt>
          <dd>{phones.map((item) => <div key={item.link}><a href={`tel:${item.link}`}>{item.label}</a></div>)}</dd>
        </div>
        <div><dt>{t('pickup.hours')}</dt><dd>{SITE.workingHours}</dd></div>
      </dl>

      <form className={styles.form} onSubmit={submit} noValidate>
        <p className={styles.legend}>{t('pickup.contact')}</p>
        <div className={styles.grid}>
          <label className={styles.field}>
            {t('ship.name')}
            <input value={name} maxLength={150} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={`${styles.field} ${phoneError ? styles.invalid : ''}`}>
            {t('ship.phone')}
            <input
              value={phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              aria-invalid={phoneError}
              onChange={(event) => {
                setPhone(formatPhone(event.target.value))
                setPhoneError(false)
              }}
            />
            {phoneError && <span className={styles.err}>{t('ship.errPhone')}</span>}
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>{t('modal.cancel')}</button>
          <button type="submit" className={styles.primary}>{t('pickup.confirm')}</button>
        </div>
      </form>
    </Modal>
  )
}
