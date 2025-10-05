import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = process.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io';
  
  return {
    plugins: [
      react(),
      // Плагин для подстановки переменных в HTML
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          const buildTime = new Date().toISOString();
          const commitHash = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || process.env.COMMIT_SHA || 'local-dev';
          const appVersion = process.env.npm_package_version || '1.0.0';
          
          return html
            .replace(/__BUILD_TIME__/g, buildTime)
            .replace(/__COMMIT_HASH__/g, commitHash)
            .replace(/__APP_VERSION__/g, appVersion);
        }
      }
    ],
    base: '/',
    
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT_HASH__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || process.env.COMMIT_SHA || 'local-dev'),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    },
    
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
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
