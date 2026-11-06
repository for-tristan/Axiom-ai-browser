import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './', // مسارات نسبية علشان الصفحة تشتغل جوا الـ WebView
  build: {
    outDir: 'web', // الناتج يطلع في assets/web اللي الـ Flutter بيقرا منه
    emptyOutDir: true,
    target: 'es2017', // كود متوافق مع الـ WebView القديم في الـ emulator
    cssTarget: 'chrome80',
  },
  server: {
    port: 5173,
    strictPort: false, // <--- هذه الخاصية تجعله ينتقل تلقائياً لمنفذ آخر إذا كان 5173 مشغولاً
  },
})