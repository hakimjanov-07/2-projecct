import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Admin panel: sayt bilan bir loyihada, lekin alohida ilova (alohida port va manzil).
// Ishga tushirish: npm run panel  ->  http://localhost:5174
const panelRoot = fileURLToPath(new URL('./panel', import.meta.url))
const outDir = fileURLToPath(new URL('./dist-panel', import.meta.url))

export default defineConfig({
  root: panelRoot,
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: { outDir, emptyOutDir: true },
})
