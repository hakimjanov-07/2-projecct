// Muqova rasmini brauzerda tekshirish (server baribir qayta tekshiradi)
export const PHOTO_EXT = ['.jpg', '.jpeg', '.png', '.webp']
export const PHOTO_MAX = 5 * 1024 * 1024

// Rasm faylini brauzerda tekshiradi (server baribir qayta tekshiradi); xato matni yoki ''
export const photoProblem = (file) => {
  if (!file) return ''
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!PHOTO_EXT.includes(ext) || !file.type.startsWith('image/')) return 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.'
  if (file.size > PHOTO_MAX) return 'Rasm hajmi 5 MB dan oshmasligi kerak.'
  return ''
}
