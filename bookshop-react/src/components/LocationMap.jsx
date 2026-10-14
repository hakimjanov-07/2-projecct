import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useRef } from 'react'
import styles from './LocationMap.module.css'

// Vite bundler Leaflet'ning standart ikonka yo'lini buzadi, shuning uchun ikonka qo'lda beriladi
const ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Umumiy xarita (OpenStreetMap, kalit talab qilmaydi).
// center: [lat, lng]; marker: [lat, lng] | null; onPick(lat, lng) berilsa xaritani bosib nuqta belgilanadi.
export default function LocationMap({ center, marker, zoom = 15, onPick, label, className = '' }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const pickRef = useRef(onPick)

  useEffect(() => {
    pickRef.current = onPick
  })

  useEffect(() => {
    const map = L.map(hostRef.current, { center, zoom, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(map)
    map.on('click', (event) => pickRef.current?.(+event.latlng.lat.toFixed(6), +event.latlng.lng.toFixed(6)))
    mapRef.current = map
    // Modal animatsiyasi tugagach o'lcham qayta hisoblanadi
    const timer = setTimeout(() => map.invalidateSize(), 250)
    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marker va markaz tashqaridan o'zgarsa yangilanadi
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (marker) {
      if (markerRef.current) markerRef.current.setLatLng(marker)
      else markerRef.current = L.marker(marker, { icon: ICON, keyboard: false }).addTo(map)
      map.setView(marker, Math.max(map.getZoom(), zoom))
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [marker?.[0], marker?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={hostRef} className={`${styles.map} ${onPick ? styles.pickable : ''} ${className}`} role="application" aria-label={label} />
}
