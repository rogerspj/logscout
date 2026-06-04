import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/logscout/',
  plugins: [react()],
  server: {
    proxy: {
      '/logscout-api': 'http://localhost:8002',
    },
  },
})
