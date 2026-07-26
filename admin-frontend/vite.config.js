import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/admin/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Garante que o bundle final fique em admin-frontend/dist/
    // O Dockerfile copia de /app/dist para /usr/share/nginx/html
    emptyOutDir: true,
  },
})
