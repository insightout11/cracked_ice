import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/app-v2-${Date.now()}.[hash].js`,
        chunkFileNames: `assets/chunk-v2-${Date.now()}.[hash].js`,
        assetFileNames: `assets/asset-v2-${Date.now()}.[hash].[ext]`
      }
    }
  }
})