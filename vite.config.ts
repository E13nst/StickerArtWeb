import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = process.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io';
  
  return {
    plugins: [react()],
    base: mode === 'production' ? '/mini-app-react/' : '/',
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
    },
    
    server: {
      port: 3000,
      host: true,
      proxy: {
        // Проксируем API запросы на бэкенд
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: true,
        },
        '/auth': {
          target: backendUrl,
          changeOrigin: true,
          secure: true,
        }
      }
    }
  }
});
