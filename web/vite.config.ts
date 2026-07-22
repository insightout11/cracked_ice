import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Force rebuild to pick up TypeScript interface changes
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Allow importing config/season.json from the repo root (one level above web/).
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
