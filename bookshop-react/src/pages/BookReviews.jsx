import { Navigate, useParams } from 'react-router-dom'

// Izohlar endi kitob sahifasidagi "Izohlar" tabida; eski havolalar shu yerga yo'naltiriladi.
export default function BookReviews() {
  const { id } = useParams()
  return <Navigate to={`/books/${id}?tab=reviews`} replace />
}
