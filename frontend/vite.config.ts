import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: './src',
  build: {
    outDir: resolve(__dirname, '../static'),  // Absolute path to static directory
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})