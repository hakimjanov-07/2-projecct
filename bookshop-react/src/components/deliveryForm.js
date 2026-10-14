// Yetkazib berish formasi uchun yordamchilar (maska, tekshiruv, oxirgi manzilni eslab qolish)
const STORAGE_KEY = 'bookshop-delivery'
const SAVED_FIELDS = ['recipient_name', 'recipient_phone', 'city', 'district', 'street', 'house']

export const EMPTY_FORM = {
  recipient_name: '',
  recipient_phone: '',
  city: '',
  district: '',
  street: '',
  house: '',
  delivery_comment: '',
  delivery_lat: null,
  delivery_lng: null,
}

// "+998 90 123 45 67" ko'rinishi; faqat 9 ta mahalliy raqam saqlanadi
export function formatPhone(raw) {
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('998')) digits = digits.slice(3)
  digits = digits.slice(0, 9)
  if (!digits) return ''
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean)
  return `+998 ${parts.join(' ')}`
}

export const isPhoneComplete = (value) => String(value).replace(/\D/g, '').length === 12

export function loadSavedForm() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return null
    const text = SAVED_FIELDS.reduce((acc, key) => ({ ...acc, [key]: typeof saved[key] === 'string' ? saved[key] : '' }), {})
    const hasPoint = Number.isFinite(saved.delivery_lat) && Number.isFinite(saved.delivery_lng)
    return { ...text, delivery_lat: hasPoint ? saved.delivery_lat : null, delivery_lng: hasPoint ? saved.delivery_lng : null }
  } catch {
    return null
  }
}

// Izoh har buyurtmaga xos bo'lgani uchun eslab qolinmaydi; xaritadagi nuqta eslab qolinadi
export function saveForm(form) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...SAVED_FIELDS.reduce((acc, key) => ({ ...acc, [key]: form[key] || '' }), {}),
      delivery_lat: form.delivery_lat ?? null,
      delivery_lng: form.delivery_lng ?? null,
    }))
  } catch {
    // Xotira mavjud bo'lmasa, manzil keyingi safar eslab qolinmaydi
  }
}

export function formatAddress(form) {
  return [form.city, form.district, form.street, form.house].filter(Boolean).join(', ')
}
