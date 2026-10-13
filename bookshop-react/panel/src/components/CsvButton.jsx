import { useState } from 'react'
import { downloadCsv } from '../api'

// Hozirgi filtrlar bilan ro'yxatni CSV (Excel) qilib yuklaydi
export default function CsvButton({ kind, params }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const click = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await downloadCsv(kind, params)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={click} disabled={busy} title="Hozirgi filtrlar bilan Excel (CSV) faylga yuklash">
        {busy ? 'Tayyorlanmoqda…' : '⬇ CSV yuklash'}
      </button>
      {failed && <span className="csv-error">Yuklab bo'lmadi</span>}
    </>
  )
}
