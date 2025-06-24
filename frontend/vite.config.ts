import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: './src',
  build: {
    outDir: '../../static',  // Output to your FastAPI static directory
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
      '/api': 'http://localhost:8000'  // Proxy API calls to your FastAPI server
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})