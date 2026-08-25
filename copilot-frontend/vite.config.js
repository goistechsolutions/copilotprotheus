import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false // Desabilitar em prod para não expor código
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000' // Dev proxy para o backend FastAPI
    }
  }
})
