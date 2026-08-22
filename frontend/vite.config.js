import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/digilocker': 'http://127.0.0.1:8000',
      '/verify': 'http://127.0.0.1:8000',
      '/sessions': 'http://127.0.0.1:8000',
      '/stats': 'http://127.0.0.1:8000',
      '/audit': 'http://127.0.0.1:8000',
      '/context': 'http://127.0.0.1:8000',
    },
  },
})
