import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1600 },
  server: {
    proxy: {
      // Lader "netlify dev"-funktionen virke lokalt uden ekstra opsætning
      '/.netlify': 'http://localhost:8888'
    }
  }
})
