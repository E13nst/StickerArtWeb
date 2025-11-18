// ✅ CRITICAL: Импортируем React ПЕРВЫМ для правильного порядка загрузки chunks
// Это гарантирует что react-vendor загрузится до всех остальных vendor chunks
import React from 'react'
import ReactDOM from 'react-dom/client'

// Затем импортируем приложение
import App from './App.tsx'
import './index.css'

// ✅ DEEP OPTIMIZATION: Performance monitoring
import { performanceMonitor } from './utils/performanceMonitor'
// ✅ HTTP Caching: Service Worker для кеширования запросов
import { registerServiceWorker } from './utils/serviceWorkerRegistration'

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

// ✅ HTTP Caching: Регистрация Service Worker
// Работает как в dev, так и в production для кеширования стикеров
window.addEventListener('load', () => {
  registerServiceWorker().then((registration) => {
    if (registration) {
      console.log('✅ Service Worker активирован для HTTP кеширования');
    }
  });
});
