import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io',
        changeOrigin: true,
        secure: true,
      },
      '/auth': {
        target: process.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io',
        changeOrigin: true,
        secure: true,
      }
    }
  }
});
