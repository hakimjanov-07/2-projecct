import { useState } from 'react'
import { downloadBookTemplate, importBooks } from '../api'
import { num } from '../format'

const MAX_BYTES = 2 * 1024 * 1024
const STATUS = {
  new: ['Yangi', 'badge-ok'],
  error: ['Xato', 'badge-err'],
  duplicate: ['Takror (mavjud)', 'badge-dup'],
}

const messageOf = (err) => err.response?.data?.detail || "So'rov bajarilmadi. Qayta urinib ko'ring."

// Ommaviy (CSV) qo'shish: 1) fayl -> 2) serverda tekshiruv (hech narsa yozilmaydi) -> 3) tasdiqlash
export default function BulkImport({ onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null) // preview javobi
  const [done, setDone] = useState(null) // commit javobi
  const [skipErrors, setSkipErrors] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = (e) => {
    const picked = e.target.files?.[0] || null
    setResult(null)
    setDone(null)
    setMessage('')
    if (picked && picked.size > MAX_BYTES) {
      setFile(null)
      setMessage('Fayl hajmi 2 MB dan oshmasligi kerak.')
      return
    }
    setFile(picked)
  }

  const check = async () => {
    setBusy(true)
    setMessage('')
    try {
      setResult(await importBooks(file, 'preview'))
    } catch (err) {
      setResult(null)
      setMessage(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    setBusy(true)
    setMessage('')
    try {
      const data = await importBooks(file, 'commit', skipErrors)
      setDone(data)
      onDone()
    } catch (err) {
      setMessage(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  const summary = result?.summary
  const canCommit = summary && summary.new > 0 && (summary.error === 0 || skipErrors)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ommaviy qo'shish">
        <header className="drawer-head">
          <h2>Kitoblarni ommaviy qo'shish</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Yopish">✕</button>
        </header>

        {done ? (
          <div>
            <p className="notice-ok">
              Qo'shildi: <strong>{num(done.created)}</strong> ta kitob.
              {' '}O'tkazib yuborildi: takror {num(done.skipped_duplicates)} ta, xatoli {num(done.skipped_errors)} ta.
            </p>
            <p className="muted">Kitoblar muqovasiz qo'shildi — rasmni ro'yxatdagi "Rasm" tugmasi orqali yuklang.</p>
            <div className="drawer-actions"><button type="button" className="btn btn-primary" onClick={onClose}>Yopish</button></div>
          </div>
        ) : (
          <>
            <p className="muted">
              CSV ustunlari: nom, muallif, kategoriya, til, narx, tannarx, sahifalar, nashriyot, tavsif, ombor, holat.
              Majburiy: nom, muallif, kategoriya, narx, tannarx. Ajratgich ; yoki , (o'zi aniqlanadi), UTF-8, ko'pi bilan 500 qator va 2 MB.
              Kategoriya oldindan mavjud bo'lishi kerak; yangi muallif avtomatik yaratiladi.
            </p>
            <div className="bulk-pick">
              <input type="file" accept=".csv,text/csv" onChange={pick} />
              <button type="button" className="btn btn-ghost" onClick={() => downloadBookTemplate().catch(() => setMessage("Namunani yuklab bo'lmadi."))}>⬇ Namuna CSV</button>
              <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={check}>{busy && !result ? 'Tekshirilmoqda…' : 'Tekshirish'}</button>
            </div>

            {message && <p className="alert">{message}</p>}

            {summary && (
              <>
                <p className="bulk-summary">
                  Jami {num(summary.total)} qator: <strong className="ok">{num(summary.new)} yangi</strong>
                  {summary.new_authors > 0 && <> ({num(summary.new_authors)} ta yangi muallif)</>},
                  {' '}<strong>{num(summary.duplicate)} takror</strong>,
                  {' '}<strong className={summary.error ? 'bad' : ''}>{num(summary.error)} xato</strong>.
                </p>
                <div className="table-wrap bulk-table">
                  <table className="table">
                    <thead><tr><th>#</th><th>Kitob</th><th>Muallif</th><th>Kategoriya</th><th className="right">Narx</th><th>Natija</th></tr></thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.row} className={`row-${r.status}`}>
                          <td>{r.row}</td>
                          <td>{r.name}</td>
                          <td>{r.author}</td>
                          <td>{r.category}</td>
                          <td className="right">{r.price}</td>
                          <td><span className={`badge-mini ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>{r.message && <small className="sub">{r.message}</small>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {summary.error > 0 && (
                  <label className="check">
                    <input type="checkbox" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} />
                    Faqat xatosizlarini qo'shish (xatoli qatorlar o'tkazib yuboriladi). Belgilanmasa, bitta xato bo'lsa ham hech narsa qo'shilmaydi.
                  </label>
                )}
                <div className="drawer-actions">
                  <button type="button" className="btn btn-primary" disabled={!canCommit || busy} onClick={commit}>
                    {busy ? 'Yozilmoqda…' : `${num(summary.new)} ta kitobni qo'shish`}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
