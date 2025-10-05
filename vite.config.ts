import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = 'https://stickerartgallery-e13nst.amvera.io';
  
  return {
    plugins: [react()],
    base: '/',
    
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            mui: ['@mui/material', '@mui/icons-material'],
            router: ['react-router-dom'],
            state: ['zustand']
          }
        }
      }
    },
    
    server: {
      port: 3000,
      host: true,
      force: true, // Принудительная очистка кеша
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
