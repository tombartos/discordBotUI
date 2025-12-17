import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/invitation': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/role': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/user': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ping': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/bot-ping': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bot-ping$/, '/ping'),
      },
    },
  },
})
