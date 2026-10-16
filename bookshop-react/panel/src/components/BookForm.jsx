import { useMemo, useState } from 'react'
import { createBook, getBookOptions } from '../api'
import { useFetch } from '../useFetch'
import { Loading } from './Bits'
import { photoProblem } from '../photo'

const LANGUAGES = [
  ['uzbek', "O'zbekcha"], ['russian', 'Ruscha'], ['english', 'Inglizcha'],
  ['turkish', 'Turkcha'], ['german', 'Nemischa'], ['others', 'Boshqa til'],
]
const EMPTY = {
  name: '', author: '', newAuthor: '', category: '', language: 'uzbek', price: '', cost_price: '',
  pages: '', publisher: '', about: '', stock: '', status: 'active',
}

const isPositiveInt = (v) => /^\d+$/.test(v) && Number(v) > 0

// Bitta kitob qo'shish oynasi
export default function BookForm({ onClose, onCreated }) {
  const { data: options, error } = useFetch(getBookOptions, 'options')
  const [form, setForm] = useState(EMPTY)
  const [authorMode, setAuthorMode] = useState('existing') // 'existing' | 'new'
  const [authorSearch, setAuthorSearch] = useState('')
  const [photo, setPhoto] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo])
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const authors = useMemo(() => {
    const q = authorSearch.trim().toLowerCase()
    return (options?.authors || []).filter((a) => !q || a.name.toLowerCase().includes(q))
  }, [options, authorSearch])

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Kitob nomini kiriting.'
    else if (form.name.trim().length > 50) e.name = 'Nom 50 belgidan oshmasligi kerak.'
    if (authorMode === 'existing' && !form.author) e.author = 'Muallifni tanlang.'
    if (authorMode === 'new' && !form.newAuthor.trim()) e.author = 'Yangi muallif ismini kiriting.'
    if (!form.category) e.category = 'Kategoriyani tanlang.'
    if (!isPositiveInt(form.price)) e.price = 'Narx musbat butun son bo\'lishi kerak.'
    if (!isPositiveInt(form.cost_price)) e.cost_price = 'Tannarx musbat butun son bo\'lishi kerak.'
    if (form.pages && !isPositiveInt(form.pages)) e.pages = 'Sahifalar soni musbat butun son bo\'lishi kerak.'
    if (form.stock && !/^\d+$/.test(form.stock)) e.stock = 'Ombor soni butun son bo\'lishi kerak.'
    const photoError = photoProblem(photo)
    if (photoError) e.photo = photoError
    return e
  }

  const submit = async (event) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    if (Number(form.price) < Number(form.cost_price) && !window.confirm('Narx tannarxdan past: kitob zarar bilan sotiladi. Baribir qo\'shilsinmi?')) return

    const body = new FormData()
    body.append('name', form.name.trim())
    if (authorMode === 'existing') body.append('author', form.author)
    else body.append('new_author', form.newAuthor.trim())
    body.append('category', form.category)
    body.append('language', form.language)
    body.append('price', form.price)
    body.append('cost_price', form.cost_price)
    body.append('status', form.status)
    if (form.pages) body.append('pages', form.pages)
    if (form.publisher.trim()) body.append('publisher', form.publisher.trim())
    if (form.about.trim()) body.append('about', form.about.trim())
    if (form.stock !== '') body.append('stock', form.stock) // bo'sh = cheklanmagan (yuborilmaydi)
    if (photo) body.append('photo', photo)

    setBusy(true)
    try {
      const created = await createBook(body)
      onCreated(created)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object' && !data.detail) {
        const next = {}
        Object.entries(data).forEach(([k, v]) => { next[k === 'new_author' ? 'author' : k] = Array.isArray(v) ? v[0] : String(v) })
        setErrors(next)
      } else {
        setErrors({ form: data?.detail || "Saqlab bo'lmadi. Qayta urinib ko'ring." })
      }
    } finally {
      setBusy(false)
    }
  }

  const field = (key, label, input, hint) => (
    <label className={`field ${errors[key] ? 'has-error' : ''}`}>
      <span>{label}</span>
      {input}
      {errors[key] ? <small className="field-error">{errors[key]}</small> : hint && <small className="field-hint">{hint}</small>}
    </label>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kitob qo'shish">
        <header className="drawer-head">
          <h2>Kitob qo'shish</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Yopish">✕</button>
        </header>

        {!options ? <Loading error={error} /> : (
          <form className="book-form" onSubmit={submit} noValidate>
            {field('name', 'Nomi *', <input value={form.name} onChange={set('name')} maxLength={50} autoFocus />)}

            <div className={`field ${errors.author ? 'has-error' : ''}`}>
              <span>Muallif *</span>
              <div className="seg">
                <button type="button" className={authorMode === 'existing' ? 'on' : ''} onClick={() => setAuthorMode('existing')}>Mavjud muallif</button>
                <button type="button" className={authorMode === 'new' ? 'on' : ''} onClick={() => setAuthorMode('new')}>Yangi muallif</button>
              </div>
              {authorMode === 'existing' ? (
                <>
                  <input placeholder="Muallifni qidirish…" value={authorSearch} onChange={(e) => setAuthorSearch(e.target.value)} />
                  <select value={form.author} onChange={set('author')} size={Math.min(5, Math.max(2, authors.length))}>
                    {authors.length === 0 && <option disabled>Topilmadi</option>}
                    {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </>
              ) : (
                <input placeholder="Muallifning ismi familiyasi" value={form.newAuthor} onChange={set('newAuthor')} maxLength={100} />
              )}
              {errors.author && <small className="field-error">{errors.author}</small>}
            </div>

            <div className="form-row">
              {field('category', 'Kategoriya *', (
                <select value={form.category} onChange={set('category')}>
                  <option value="">Tanlang…</option>
                  {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ))}
              {field('language', 'Til', (
                <select value={form.language} onChange={set('language')}>
                  {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ))}
            </div>

            <div className="form-row">
              {field('price', "Narx (so'm) *", <input type="number" min="1" step="1" inputMode="numeric" value={form.price} onChange={set('price')} />)}
              {field('cost_price', "Tannarx (so'm) *", <input type="number" min="1" step="1" inputMode="numeric" value={form.cost_price} onChange={set('cost_price')} />)}
            </div>
            {Number(form.price) > 0 && Number(form.cost_price) > 0 && Number(form.price) < Number(form.cost_price) && (
              <p className="field-warn">Diqqat: narx tannarxdan past — zarar bilan sotiladi.</p>
            )}

            <div className="form-row">
              {field('pages', 'Sahifalar soni', <input type="number" min="1" step="1" value={form.pages} onChange={set('pages')} />)}
              {field('stock', 'Ombor soni', <input type="number" min="0" step="1" placeholder="cheklanmagan" value={form.stock} onChange={set('stock')} />, "Bo'sh = cheklanmagan")}
            </div>

            {field('publisher', 'Nashriyot', <input value={form.publisher} onChange={set('publisher')} maxLength={100} />, "Bo'sh bo'lsa \"—\" yoziladi")}
            {field('about', 'Tavsif', <textarea rows={3} value={form.about} onChange={set('about')} />)}

            {field('status', 'Holat', (
              <select value={form.status} onChange={set('status')}>
                <option value="active">Faol</option>
                <option value="deactive">Faol emas</option>
              </select>
            ))}

            <div className={`field ${errors.photo ? 'has-error' : ''}`}>
              <span>Muqova rasmi</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(e) => { setPhoto(e.target.files?.[0] || null); setErrors((x) => ({ ...x, photo: '' })) }} />
              {photo && !photoProblem(photo) && <img className="cover-preview" src={preview} alt="Muqova ko'rinishi" />}
              {errors.photo ? <small className="field-error">{errors.photo}</small> : <small className="field-hint">JPG, PNG yoki WEBP, 5 MB gacha. Keyin ham yuklash mumkin.</small>}
            </div>

            {errors.form && <p className="alert">{errors.form}</p>}
            <div className="drawer-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saqlanmoqda…' : "Qo'shish"}</button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
