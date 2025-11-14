// ✅ CRITICAL: Импортируем React ПЕРВЫМ для правильного порядка загрузки chunks
// Это гарантирует что react-vendor загрузится до всех остальных vendor chunks
import React from 'react'
import ReactDOM from 'react-dom/client'

// Затем импортируем приложение
import App from './App.tsx'
import './index.css'

// ✅ DEEP OPTIMIZATION: Performance monitoring
import { performanceMonitor } from './utils/performanceMonitor'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// ✅ DEEP OPTIMIZATION: Инициализация performance monitoring
performanceMonitor.initialize();

// Логируем метрики после загрузки
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const report = performanceMonitor.generateReport();
      console.log('📊 Performance Report:', report);
      
      // TODO: Отправка на бэкенд (раскомментируйте когда endpoint готов)
      // performanceMonitor.sendReport('/api/analytics/performance');
    }, 3000); // Ждём 3 секунды чтобы все метрики собрались
  });
}

// ✅ P1 OPTIMIZATION: Service Worker для offline-режима и кэширования
// Регистрируем только в production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/miniapp/sw.js')
      .then((registration) => {
        console.log('✅ SW registered:', registration.scope);
        
        // Проверяем обновления каждые 60 секунд
        setInterval(() => {
          registration.update();
        }, 60000);
        
        // Слушаем обновления SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Новая версия доступна
                console.log('🔄 New version available. Reload to update.');
                
                // Можно показать уведомление пользователю
                if (window.confirm('Доступна новая версия приложения. Обновить?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('❌ SW registration failed:', error);
      });
      
    // Обработка обновления SW
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
