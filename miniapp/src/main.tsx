// ✅ CRITICAL: Импортируем React ПЕРВЫМ для правильного порядка загрузки chunks
// Это гарантирует что react-vendor загрузится до всех остальных vendor chunks
import React from 'react'
import ReactDOM from 'react-dom/client'

// ✅ TEMP DIAG: Самый ранний лог (до React render, до роутера, ДО импорта launchParams)
// Это позволяет увидеть состояние ДО захвата initData
(() => {
  const tg = (window as any).Telegram?.WebApp;
  const href = window.location.href;
  const search = window.location.search;
  const hash = window.location.hash;
  const hasTgData = /tgWebAppData=/.test(search) || /tgWebAppData=/.test(hash);
  const initLen = typeof tg?.initData === 'string' ? tg.initData.length : -1;

  console.log('[TG_DIAG] href=', href);
  console.log('[TG_DIAG] search=', search);
  console.log('[TG_DIAG] hash=', hash);
  console.log('[TG_DIAG] has tgWebAppData param=', hasTgData);
  console.log('[TG_DIAG] Telegram.WebApp exists=', !!tg);
  console.log('[TG_DIAG] initData.len=', initLen);
  if (initLen > 0) console.log('[TG_DIAG] initData.head=', tg.initData.slice(0, 120));
  console.log('[TG_DIAG] initDataUnsafe.keys=', tg?.initDataUnsafe ? Object.keys(tg.initDataUnsafe) : null);
})();

// ✅ FIX: Импортируем захватчик initData ДО всего остального
// Это гарантирует захват параметров из URL до инициализации роутера
import { getInitData, smokeTestInitDataLocation } from './telegram/launchParams';

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
