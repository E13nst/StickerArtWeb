import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = process.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io';
  
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
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './miniapp/src'),
      },
    },
    
    build: {
      outDir: '../dist/miniapp', // Относительно root (miniapp/)
      emptyOutDir: true, // Очищаем только dist/miniapp
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
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
