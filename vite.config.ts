import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8080';
  const stickerProcessorProxyTarget = env.VITE_STICKER_PROCESSOR_PROXY_TARGET || 'https://sticker-processor-e13nst.amvera.io';
  
  return {
    plugins: [
      react(),
      {
        name: 'miniapp-trailing-slash',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/miniapp') {
              req.url = '/miniapp/';
            }
            next();
          });
        },
      },
    ],
    base: '/miniapp/',
    root: 'miniapp', // Указываем корень проекта
    define: {
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './miniapp/src'),
      },
    },
    
    // Public директория для статичных файлов (sw.js и др.)
    publicDir: path.resolve(__dirname, './miniapp/public'),
    
    build: {
      outDir: '../dist/miniapp', // Относительно root (miniapp/)
      emptyOutDir: true, // Очищаем только dist/miniapp
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild', // Используем esbuild (по умолчанию в Vite)
      cssMinify: true,
      // Настройки esbuild для удаления console.log и debugger
      esbuild: {
        drop: ['console', 'debugger'], // Удаляем console.* и debugger в production
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks - разделяем по библиотекам для лучшего кэширования
            if (id.includes('node_modules')) {
              // React ecosystem (часто используется, редко меняется)
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }
              
              // Material-UI (большая библиотека, редко меняется)
              if (id.includes('@mui') || id.includes('@emotion')) {
                return 'mui-vendor';
              }
              
              // State management (Zustand + persist)
              if (id.includes('zustand')) {
                return 'state-vendor';
              }
              
              // API & networking (axios)
              if (id.includes('axios')) {
                return 'api-vendor';
              }
              
              // Lottie animations (тяжёлая библиотека)
              if (id.includes('lottie')) {
                return 'lottie-vendor';
              }
              
              // Остальные dependencies
              return 'vendor';
            }
            
            // Page-based code splitting (каждая страница в отдельном chunk)
            if (id.includes('/src/pages/')) {
              const match = id.match(/pages\/(.+?)\.(tsx|ts|jsx|js)/);
              if (match) {
                return `page-${match[1].toLowerCase()}`;
              }
            }
            
            // Тяжёлые компоненты галереи
            if (id.includes('SimpleGallery') || id.includes('VirtualizedGallery')) {
              return 'gallery-heavy';
            }
            
            // Модальные окна (загружаются по требованию)
            if (id.includes('StickerPackModal') || id.includes('StickerSetDetail') || id.includes('UploadStickerPackModal')) {
              return 'modals';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: true
        },
        '/auth': {
          target: backendUrl,
          changeOrigin: true,
          secure: true
        },
        '/stickers': {
          target: stickerProcessorProxyTarget,
          changeOrigin: true,
          secure: true
        }
      }
    }
  }
});
