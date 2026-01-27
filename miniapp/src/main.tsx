// ✅ CRITICAL: Импортируем React ПЕРВЫМ для правильного порядка загрузки chunks
// Это гарантирует что react-vendor загрузится до всех остальных vendor chunks
import React from 'react'
import ReactDOM from 'react-dom/client'

// ✅ FIX: Импортируем захватчик initData ДО всего остального
// Это гарантирует захват параметров из URL до инициализации роутера
import { getInitData, smokeTestInitDataLocation } from './telegram/launchParams';

// ✅ TEMP DIAG: Диагностика initData ДО React render (для inline query контекста)
// Запускается синхронно до импорта App и рендера React
(() => {
  const tg = (window as any).Telegram?.WebApp;
  const smokeTest = smokeTestInitDataLocation();
  const capturedInitData = getInitData();
  const initLen = typeof tg?.initData === 'string' ? tg.initData.length : -1;
  const capturedLen = capturedInitData ? capturedInitData.length : 0;

  console.log('[TG_DIAG] href=', smokeTest.href);
  console.log('[TG_DIAG] search=', smokeTest.search);
  console.log('[TG_DIAG] hash=', smokeTest.hash);
  console.log('[TG_DIAG] has tgWebAppData in search=', smokeTest.hasInSearch);
  console.log('[TG_DIAG] has tgWebAppData in hash=', smokeTest.hasInHash);
  console.log('[TG_DIAG] Telegram.WebApp exists=', !!tg);
  console.log('[TG_DIAG] Telegram.WebApp.initData.len=', initLen);
  console.log('[TG_DIAG] captured initData.len=', capturedLen);
  
  // Показываем источник initData
  if (capturedInitData) {
    const source = initLen > 0 ? 'Telegram.WebApp' : (smokeTest.hasInSearch ? 'search' : smokeTest.hasInHash ? 'hash' : 'sessionStorage');
    console.log('[TG_DIAG] initData source=', source);
    
    const initDataPreview = capturedInitData.slice(0, 120);
    // Маскируем чувствительные данные
    const masked = initDataPreview
      .replace(/user=([^&]+)/, (_, user) => {
        try {
          const parsed = JSON.parse(decodeURIComponent(user));
          return `user={"id":${parsed.id},"first_name":"***","username":"***"}`;
        } catch {
          return 'user=***';
        }
      })
      .replace(/hash=([^&]+)/, 'hash=***')
      .replace(/query_id=([^&]+)/, 'query_id=***');
    console.log('[TG_DIAG] initData.head=', masked);
  }
  
  console.log('[TG_DIAG] initDataUnsafe.keys=', tg?.initDataUnsafe ? Object.keys(tg.initDataUnsafe) : null);
  console.log('[TG_DIAG] platform=', tg?.platform);
  console.log('[TG_DIAG] version=', tg?.version);
  
  // ✅ КРИТИЧНО: Если в Desktop/Mobile tgWebAppData в hash - причина найдена
  if (smokeTest.hasInHash && !smokeTest.hasInSearch) {
    console.warn('[TG_DIAG] ⚠️ tgWebAppData находится в hash (не в search) - это может быть причиной проблем в Desktop/Mobile');
  }
})();

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
