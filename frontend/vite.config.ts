/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the API is proxied so the refresh-token cookie stays same-origin.
const target = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Keep the browser's Host header: the API builds absolute media URLs from it,
      // and with changeOrigin they pointed at the proxy target (e.g. http://api:8000).
      '/api': { target },
      '/media': { target, changeOrigin: true },
      '/ws': { target, ws: true, changeOrigin: true },
      '/admin': { target, changeOrigin: true },
      '/static': { target, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})