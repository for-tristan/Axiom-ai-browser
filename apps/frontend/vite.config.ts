import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false, // <--- هذه الخاصية تجعله ينتقل تلقائياً لمنفذ آخر إذا كان 5173 مشغولاً
  },
})