// Yorug' / qorong'i tema: tanlov brauzerda eslab qolinadi va <html data-theme="..."> ga yoziladi
const KEY = 'bookshop-theme'

export const getTheme = () => {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Brauzer xotirasi yo'q bo'lsa, tema faqat shu sessiyada qoladi.
  }
}

// Sahifa chizilishidan oldin chaqiriladi (yorug' ekran chaqnab ketmasligi uchun)
export const initTheme = () => {
  document.documentElement.dataset.theme = getTheme()
}
