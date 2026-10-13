// Raqam va sana ko'rinishlari

const LOCALE = 'ru-RU' // minglik guruhlar bo'shliq bilan: 1 234 567

export const money = (value) => `${Number(value || 0).toLocaleString(LOCALE)} so'm`

export const num = (value) => Number(value || 0).toLocaleString(LOCALE)

// Grafik o'qlari uchun qisqa ko'rinish: 1,2 mln, 450 ming
export const compact = (value) => {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} mln`
  if (n >= 1_000) return `${Math.round(n / 1_000)} ming`
  return String(n)
}

export const dateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

export const date = (iso) =>
  iso ? new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const shortDay = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' })

export const STATUS_LABELS = {
  confirmed: 'Tasdiqlangan',
  cancelled: 'Bekor qilingan',
  pending: 'Savatda',
}
