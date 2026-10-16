import { useEffect } from 'react'

const BRAND = 'BOOK.UZ'
// index.html dagi bosh sarlavha: sahifadan chiqilganda (yoki sarlavha bo'sh bo'lsa) shunga qaytadi
const BASE_TITLE = (typeof document !== 'undefined' && document.title) || `${BRAND} — Onlayn kitob do'koni`

// Sahifa sarlavhasi: "Kitoblar — BOOK.UZ". Sarlavhada brend bo'lsa (masalan, bosh sahifa) o'zgarishsiz qo'yiladi.
// Sarlavha bo'sh bo'lsa (masalan, kitob hali yuklanmagan) bosh sarlavha turadi.
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? (title.includes(BRAND) ? title : `${title} — ${BRAND}`) : BASE_TITLE
    return () => { document.title = BASE_TITLE }
  }, [title])
}
