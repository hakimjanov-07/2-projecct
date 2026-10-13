// Panel temasi (saytnikidan alohida kalitda saqlanadi)
const KEY = 'panel_theme'

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
    // xotira yo'q bo'lsa, faqat shu sessiyada qoladi
  }
}

export const initTheme = () => {
  document.documentElement.dataset.theme = getTheme()
}
