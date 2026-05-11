import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    https: fs.existsSync(path.join(__dirname, '../cert.pem')) ? {
      key: fs.readFileSync(path.join(__dirname, '../key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../cert.pem')),
    } : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/unknown-faces': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
