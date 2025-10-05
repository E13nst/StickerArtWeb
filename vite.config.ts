import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = 'https://stickerartgallery-e13nst.amvera.io';
  
  // Build metadata для замены в index.html
  const buildTime = new Date().toISOString()
  const gitHash = 'unknown' // Будет заменено в CI
  const appVersion = '1.0.0'
  
  return {
    plugins: [react()],
    base: '/mini-app-react/',
    
    define: {
      __BUILD_TIME__: JSON.stringify(buildTime),
      __COMMIT_HASH__: JSON.stringify(gitHash),
      __APP_VERSION__: JSON.stringify(appVersion)
    },
    
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
