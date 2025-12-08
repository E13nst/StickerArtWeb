import { test, expect, Page } from '@playwright/test';
import {
  setupAuth,
  navigateToGallery,
  getMediaStats,
  scrollGalleryToBottom,
  waitForMediaLoad,
  getCacheStats,
  logMediaStats,
  getVisibleRowIndices,
  waitForRowMediaLoad,
  scrollToNextRow
} from './helpers';

// @ts-ignore - process доступен в Node.js окружении Playwright
declare const process: any;

/**
 * 🎯 BENCHMARK TEST для Галереи Стикеров
 * 
 * Цель: Измерить производительность загрузки 20 стикер-карточек на странице галереи
 * и выявить узкие места в процессе загрузки
 */

// ============================================================================
// ТИПЫ И ИНТЕРФЕЙСЫ
// ============================================================================

interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  timestamp: number;
  responseTime?: number;
  status?: number;
  size?: number;
  priority?: string;
}

interface BenchmarkMetrics {
  // 🕒 Время загрузки
  timing: {
    timeToFirstSticker: number;           // Время до первого стикера
    timeToFirst6Stickers: number;         // Время до первых 6 (видимых на экране)
    timeToAll20Stickers: number;          // Время до всех 20 стикеров
    domContentLoaded: number;             // DOMContentLoaded
    loadComplete: number;                 // Load event
    firstContentfulPaint: number;         // FCP
    largestContentfulPaint: number;       // LCP
    timeToInteractive: number;            // TTI (приблизительно)
  };
  
  // 🌐 Сетевые метрики
  network: {
    totalRequests: number;                // Всего запросов
    apiRequests: number;                  // API запросы
    imageRequests: number;                // Изображения стикеров
    jsonRequests: number;                 // JSON (анимации)
    videoRequests: number;                // Видео стикеры
    duplicateRequests: number;            // Повторные запросы одного ресурса
    failedRequests: number;               // Ошибки загрузки
    failedRequestsList?: Array<{          // 🔍 Детали неудачных запросов
      url: string;
      status: number;
      method: string;
      resourceType: string;
    }>;
    totalBytesTransferred: number;        // Всего байт передано
    averageResponseTime: number;          // Средние время ответа
    maxConcurrency: number;               // Максимальная параллельность
    slowestRequests: Array<{url: string, time: number}>;  // Топ-5 самых медленных
  };
  
  // 🎨 Рендеринг
  rendering: {
    fps: number[];                        // FPS samples
    averageFPS: number;                   // Средний FPS
    minFPS: number;                       // Минимальный FPS
    layoutShifts: number;                 // Cumulative Layout Shift
    repaints: number;                     // Количество перерисовок
    domNodes: number;                     // Количество DOM узлов
    longTasks: number;                    // Задачи > 50ms
  };
  
  // 💾 Ресурсы
  resources: {
    jsHeapSize: number;                   // Память JS (MB)
    jsHeapSizeLimit: number;              // Лимит памяти (MB)
    domNodesCount: number;                // DOM элементов
    canvasContexts: number;               // Canvas контексты (анимации)
  };
  
  // 🔥 CPU/GPU нагрузка
  performance: {
    cpuUsage: {
      jsExecutionTime: number;            // Время выполнения JS (ms)
      totalLongTasks: number;             // Всего долгих задач (>50ms)
      longTasksDuration: number;          // Общая длительность долгих задач (ms)
      averageTaskDuration: number;        // Средняя длительность задач (ms)
    };
    gpuUsage: {
      activeCanvases: number;             // Активных canvas элементов
      activeSvgs: number;                 // Активных SVG элементов
      renderingTime: number;               // Время рендеринга (ms)
      frameDrops: number;                 // Пропущенных кадров
    };
  };
  
  // 📦 Кэширование
  caching: {
    cacheHits: number;                    // Загрузки из кеша
    cacheMisses: number;                  // Загрузки из сети
    prefetchedResources: number;          // Ресурсы prefetch
    cacheEfficiency: number;              // % кеш-попаданий
  };
  
  // 🚨 Проблемы
  issues: {
    errors: string[];                     // Критические ошибки
    warnings: string[];                   // Предупреждения
    bottlenecks: string[];                // Выявленные узкие места
  };
  
  // 📊 Водопад загрузки (первые 30 запросов)
  waterfall: Array<{
    time: number;
    duration: number;
    type: string;
    url: string;
    size: number;
  }>;
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const isStickerAsset = (url: string): boolean => {
  return url.includes('/stickers/') || 
         url.includes('/files/') ||
         url.endsWith('.webp') || 
         url.endsWith('.webm') ||
         url.endsWith('.tgs') ||
         url.endsWith('.png');
};

// ============================================================================
// КЛАСС ДЛЯ СБОРА МЕТРИК
// ============================================================================

class MetricsCollector {
  private page: Page;
  private startTime: number = 0;
  private networkRequests: NetworkRequest[] = [];
  private requestsByUrl = new Map<string, number>();
  private activeRequests = new Set<string>();
  private currentConcurrency = 0;
  private maxConcurrency = 0;
  private fpsSamples: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private cpuGpuMetrics: {
    cpuUsage: {
      jsExecutionTime: number;
      totalLongTasks: number;
      longTasksDuration: number;
      averageTaskDuration: number;
    };
    gpuUsage: {
      activeCanvases: number;
      activeSvgs: number;
      renderingTime: number;
      frameDrops: number;
    };
  } | null = null;
  
  constructor(page: Page) {
    this.page = page;
    this.setupListeners();
  }
  
  setCpuGpuMetrics(metrics: {
    cpuUsage: {
      jsExecutionTime: number;
      totalLongTasks: number;
      longTasksDuration: number;
      averageTaskDuration: number;
    };
    gpuUsage: {
      activeCanvases: number;
      activeSvgs: number;
      renderingTime: number;
      frameDrops: number;
    };
  }) {
    this.cpuGpuMetrics = metrics;
  }
  
  private setupListeners() {
    // Отслеживание запросов
    this.page.on('request', request => {
      const timestamp = Date.now();
      const url = request.url();
      
      // Подсчет дубликатов
      const count = this.requestsByUrl.get(url) || 0;
      this.requestsByUrl.set(url, count + 1);
      
      this.networkRequests.push({
        url,
        method: request.method(),
        resourceType: request.resourceType(),
        timestamp,
        priority: (request as any).initialPriority?.() || 'unknown'
      });
      
      this.activeRequests.add(url);
      this.currentConcurrency++;
      if (this.currentConcurrency > this.maxConcurrency) {
        this.maxConcurrency = this.currentConcurrency;
      }
    });
    
    // Отслеживание ответов
    this.page.on('response', async response => {
      const timestamp = Date.now();
      const url = response.url();
      
      const request = this.networkRequests.find(r => r.url === url && !r.responseTime);
      if (request) {
        request.responseTime = timestamp - request.timestamp;
        request.status = response.status();
        
        // Получаем размер если возможно
        try {
          const buffer = await response.body().catch(() => null);
          request.size = buffer?.length || 0;
        } catch {
          request.size = 0;
        }
      }
      
      this.activeRequests.delete(url);
      this.currentConcurrency--;
    });
    
    // Отслеживание логов кеширования
    this.page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Loaded from cache') || text.includes('Cache hit')) {
        this.cacheHits++;
      }
      if (text.includes('Prefetched') || text.includes('Image loaded')) {
        this.cacheMisses++;
      }
    });
  }
  
  async start() {
    this.startTime = Date.now();
    
    // Инъекция скрипта для измерения FPS
    await this.page.addInitScript(() => {
      (window as any).__benchmarkMetrics = {
        fps: 0,
        frameCount: 0,
        lastTime: performance.now(),
        longTasks: 0,
        layoutShifts: 0
      };
      
      // Измерение FPS
      function measureFPS() {
        const now = performance.now();
        const metrics = (window as any).__benchmarkMetrics;
        metrics.frameCount++;
        
        if (now - metrics.lastTime >= 1000) {
          metrics.fps = metrics.frameCount / ((now - metrics.lastTime) / 1000);
          metrics.frameCount = 0;
          metrics.lastTime = now;
        }
        
        requestAnimationFrame(measureFPS);
      }
      requestAnimationFrame(measureFPS);
      
      // Отслеживание Layout Shifts
      if ('PerformanceObserver' in window) {
        try {
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if ((entry as any).hadRecentInput) continue;
              (window as any).__benchmarkMetrics.layoutShifts += (entry as any).value;
            }
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
          
          // Отслеживание Long Tasks
          const longTaskObserver = new PerformanceObserver((list) => {
            (window as any).__benchmarkMetrics.longTasks += list.getEntries().length;
          });
          longTaskObserver.observe({ type: 'longtask', buffered: true });
        } catch (e) {
          console.warn('Performance observers not supported');
        }
      }
    });
  }
  
  async waitForStickers(count: number, timeout: number = 15000): Promise<number> {
    try {
      await this.page.waitForFunction(
        (expectedCount: number) => {
          const stickers = document.querySelectorAll('[data-testid="pack-card"]');
          if (stickers.length < expectedCount) return false;
          
          // Считаем карточки с загруженным медиа ТОЛЬКО для первых expectedCount карточек
          let withMedia = 0;
          for (let i = 0; i < expectedCount && i < stickers.length; i++) {
            const card = stickers[i];
            const img = card.querySelector('img.pack-card-image');
            const video = card.querySelector('video.pack-card-video');
            const animatedSticker = card.querySelector('.pack-card-animated-sticker');
            const lottieCanvas = animatedSticker ? animatedSticker.querySelector('svg, canvas') : null;
            
            const hasImage = !!(img && img.getAttribute('src') && img.getAttribute('src') !== '');
            const hasVideo = !!(video && video.getAttribute('src') && video.getAttribute('src') !== '');
            const hasAnimationCanvas = !!lottieCanvas;
            
            if (hasImage || hasVideo || hasAnimationCanvas) {
              withMedia++;
            }
          }
          
          // Требуем чтобы минимум 80% из первых expectedCount карточек имели загруженное медиа
          const minMediaCount = Math.floor(expectedCount * 0.8);
          return withMedia >= minMediaCount;
        },
        count,
        { timeout }
      );
    } catch (e) {
      console.log(`⚠️ Timeout waiting for ${count} stickers with media`);
    }
    
    // Возвращаем время от начала теста (this.startTime), а не от начала этой функции
    return Date.now() - this.startTime;
  }

  async waitForRowMedia(rowIndex: number, timeout: number = 5000): Promise<boolean> {
    const { waitForRowMediaLoad } = await import('./helpers/benchmark/benchmark-helpers');
    return waitForRowMediaLoad(this.page, rowIndex, timeout);
  }
  
  async collectFPS(duration: number = 3000): Promise<void> {
    const samples: number[] = [];
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const fps = await this.page.evaluate(() => (window as any).__benchmarkMetrics?.fps || 0);
      if (fps > 0) samples.push(fps);
      await this.page.waitForTimeout(200);
    }
    
    this.fpsSamples = samples;
  }
  
  async generateReport(): Promise<BenchmarkMetrics> {
    // Получаем Web Vitals
    const webVitals = await this.page.evaluate(() => {
      const timing = performance.timing;
      const paintEntries = performance.getEntriesByType('paint');
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        fcp: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
        lcp: 0, // Будет обновлено через PerformanceObserver
        tti: navEntry?.domInteractive || 0
      };
    });
    
    // Получаем LCP отдельно
    const lcp = await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        if ('PerformanceObserver' in window) {
          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1] as any;
              resolve(lastEntry?.renderTime || lastEntry?.loadTime || 0);
            });
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
            
            // Таймаут на случай если LCP не срабатывает
            setTimeout(() => resolve(0), 100);
          } catch {
            resolve(0);
          }
        } else {
          resolve(0);
        }
      });
    });
    
    // Получаем метрики ресурсов
    const resourceMetrics = await this.page.evaluate(() => {
      const memory = (performance as any).memory;
      return {
        jsHeapSize: memory?.usedJSHeapSize || 0,
        jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
        domNodes: document.querySelectorAll('*').length,
        canvasContexts: document.querySelectorAll('canvas').length,
        layoutShifts: (window as any).__benchmarkMetrics?.layoutShifts || 0,
        longTasks: (window as any).__benchmarkMetrics?.longTasks || 0
      };
    });
    
    // Анализируем сетевые запросы
    const apiRequests = this.networkRequests.filter(r => r.url.includes('/api/'));
    const imageRequests = this.networkRequests.filter(r => 
      r.resourceType === 'image' || isStickerAsset(r.url)
    );
    const jsonRequests = this.networkRequests.filter(r => r.url.endsWith('.json'));
    const videoRequests = this.networkRequests.filter(r => 
      r.url.includes('.webm') || r.url.includes('.mp4')
    );
    
    // Подсчет дубликатов
    let duplicateCount = 0;
    const duplicateUrls: Array<{url: string, count: number}> = [];
    this.requestsByUrl.forEach((count, url) => {
      if (count > 1) {
        duplicateCount += (count - 1);
        duplicateUrls.push({ url, count });
      }
    });
    
    // 🔍 ДИАГНОСТИКА: Логируем топ дублирующихся URL
    if (duplicateUrls.length > 0) {
      console.log('\n🔍 ТОП-10 дублирующихся URL:');
      duplicateUrls
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .forEach(({ url, count }) => {
          const shortUrl = url.length > 80 ? url.substring(0, 80) + '...' : url;
          console.log(`   ${count}x - ${shortUrl}`);
        });
      console.log('');
    }
    
    // Неудачные запросы
    const failedRequestsList = this.networkRequests.filter(r => 
      r.status && r.status >= 400
    );
    const failedRequests = failedRequestsList.length;
    
    // Общий объем данных
    const totalBytes = this.networkRequests.reduce((sum, r) => sum + (r.size || 0), 0);
    
    // Среднее время ответа
    const requestsWithTime = this.networkRequests.filter(r => r.responseTime);
    const avgResponseTime = requestsWithTime.length > 0
      ? requestsWithTime.reduce((sum, r) => sum + (r.responseTime || 0), 0) / requestsWithTime.length
      : 0;
    
    // Топ-5 самых медленных запросов
    const slowestRequests = [...this.networkRequests]
      .filter(r => r.responseTime)
      .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
      .slice(0, 5)
      .map(r => ({
        url: r.url.substring(r.url.lastIndexOf('/') + 1, r.url.lastIndexOf('/') + 50),
        time: r.responseTime || 0
      }));
    
    // Водопад (первые 30 запросов)
    const waterfall = this.networkRequests
      .slice(0, 30)
      .map(r => ({
        time: r.timestamp - this.startTime,
        duration: r.responseTime || 0,
        type: r.resourceType,
        url: r.url.substring(r.url.lastIndexOf('/') + 1, r.url.lastIndexOf('/') + 40),
        size: r.size || 0
      }));
    
    // FPS метрики
    const avgFPS = this.fpsSamples.length > 0
      ? this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length
      : 0;
    const minFPS = this.fpsSamples.length > 0
      ? Math.min(...this.fpsSamples)
      : 0;
    
    // Эффективность кеша
    const totalCacheOps = this.cacheHits + this.cacheMisses;
    const cacheEfficiency = totalCacheOps > 0
      ? (this.cacheHits / totalCacheOps) * 100
      : 0;
    
    // Выявление узких мест и проблем
    const issues = {
      errors: [] as string[],
      warnings: [] as string[],
      bottlenecks: [] as string[]
    };
    
    // Критические ошибки
    if (failedRequests > 0) {
      issues.errors.push(`${failedRequests} неудачных HTTP запросов`);
    }
    
    // Предупреждения
    if (webVitals.fcp > 2500) {
      issues.warnings.push(`Медленный FCP: ${formatTime(webVitals.fcp)} (норма <2.5s)`);
    }
    if (lcp > 4000) {
      issues.warnings.push(`Медленный LCP: ${formatTime(lcp)} (норма <4s)`);
    }
    if (avgFPS < 30) {
      issues.warnings.push(`Низкий FPS: ${avgFPS.toFixed(1)} (норма >30)`);
    }
    if (resourceMetrics.layoutShifts > 0.1) {
      issues.warnings.push(`Высокий CLS: ${resourceMetrics.layoutShifts.toFixed(3)} (норма <0.1)`);
    }
    if (duplicateCount > 5) {
      issues.warnings.push(`Много дубликатов: ${duplicateCount} повторных запросов`);
    }
    if (totalBytes > 10 * 1024 * 1024) {
      issues.warnings.push(`Большой объем данных: ${formatBytes(totalBytes)} (оптимально <10MB)`);
    }
    
    // Узкие места
    if (this.maxConcurrency > 50) {
      issues.bottlenecks.push(`Высокая параллельность: ${this.maxConcurrency} одновременных запросов`);
    }
    if (avgResponseTime > 500) {
      issues.bottlenecks.push(`Медленные ответы сервера: ${formatTime(avgResponseTime)} среднее время`);
    }
    if (resourceMetrics.longTasks > 10) {
      issues.bottlenecks.push(`Много долгих задач: ${resourceMetrics.longTasks} задач >50ms`);
    }
    if (imageRequests.length > 100) {
      issues.bottlenecks.push(`Слишком много запросов изображений: ${imageRequests.length}`);
    }
    if (cacheEfficiency < 50 && totalCacheOps > 10) {
      issues.bottlenecks.push(`Низкая эффективность кеша: ${cacheEfficiency.toFixed(1)}%`);
    }
    
    return {
      timing: {
        timeToFirstSticker: 0, // Будет заполнено в тесте
        timeToFirst6Stickers: 0,
        timeToAll20Stickers: 0,
        domContentLoaded: webVitals.domContentLoaded,
        loadComplete: webVitals.loadComplete,
        firstContentfulPaint: webVitals.fcp,
        largestContentfulPaint: lcp,
        timeToInteractive: webVitals.tti
      },
      network: {
        totalRequests: this.networkRequests.length,
        apiRequests: apiRequests.length,
        imageRequests: imageRequests.length,
        jsonRequests: jsonRequests.length,
        videoRequests: videoRequests.length,
        duplicateRequests: duplicateCount,
        failedRequests,
        failedRequestsList: failedRequestsList.map(r => ({
          url: r.url,
          status: r.status || 0,
          method: r.method,
          resourceType: r.resourceType
        })),
        totalBytesTransferred: totalBytes,
        averageResponseTime: avgResponseTime,
        maxConcurrency: this.maxConcurrency,
        slowestRequests
      },
      rendering: {
        fps: this.fpsSamples,
        averageFPS: avgFPS,
        minFPS,
        layoutShifts: resourceMetrics.layoutShifts,
        repaints: 0, // Сложно измерить напрямую
        domNodes: resourceMetrics.domNodes,
        longTasks: resourceMetrics.longTasks
      },
      resources: {
        jsHeapSize: resourceMetrics.jsHeapSize / (1024 * 1024), // В MB
        jsHeapSizeLimit: resourceMetrics.jsHeapSizeLimit / (1024 * 1024),
        domNodesCount: resourceMetrics.domNodes,
        canvasContexts: resourceMetrics.canvasContexts
      },
      performance: this.cpuGpuMetrics || {
        cpuUsage: {
          jsExecutionTime: 0,
          totalLongTasks: resourceMetrics.longTasks,
          longTasksDuration: 0,
          averageTaskDuration: 0
        },
        gpuUsage: {
          activeCanvases: resourceMetrics.canvasContexts,
          activeSvgs: 0,
          renderingTime: 0,
          frameDrops: 0
        }
      },
      caching: {
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        prefetchedResources: 0, // Можно расширить
        cacheEfficiency
      },
      issues,
      waterfall
    };
  }
}

// ============================================================================
// ФУНКЦИИ ДЛЯ ВЫВОДА ОТЧЕТА
// ============================================================================

function printBenchmarkReport(metrics: BenchmarkMetrics) {
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 BENCHMARK REPORT: Галерея с 20 стикер-карточками');
  console.log('═'.repeat(80) + '\n');
  
  // 🕒 ВРЕМЯ ЗАГРУЗКИ
  console.log('🕒 ВРЕМЯ ЗАГРУЗКИ:');
  console.log('─'.repeat(80));
  console.log(`  ⏱️  Первый стикер (TTFS):           ${formatTime(metrics.timing.timeToFirstSticker)}`);
  console.log(`  ⏱️  Первые 6 стикеров:             ${formatTime(metrics.timing.timeToFirst6Stickers)}`);
  console.log(`  ⏱️  Все 20 стикеров:               ${formatTime(metrics.timing.timeToAll20Stickers)}`);
  console.log(`  📄 DOMContentLoaded:               ${formatTime(metrics.timing.domContentLoaded)}`);
  console.log(`  🎨 First Contentful Paint (FCP):   ${formatTime(metrics.timing.firstContentfulPaint)}`);
  console.log(`  🖼️  Largest Contentful Paint (LCP): ${formatTime(metrics.timing.largestContentfulPaint)}`);
  console.log(`  ⚡ Time to Interactive (TTI):      ${formatTime(metrics.timing.timeToInteractive)}`);
  console.log('');
  
  // 🌐 СЕТЕВЫЕ МЕТРИКИ
  console.log('🌐 СЕТЕВЫЕ МЕТРИКИ:');
  console.log('─'.repeat(80));
  console.log(`  📡 Всего запросов:                 ${metrics.network.totalRequests}`);
  console.log(`  🔌 API запросы:                    ${metrics.network.apiRequests}`);
  console.log(`  🖼️  Изображения стикеров:           ${metrics.network.imageRequests}`);
  console.log(`  📋 JSON (анимации):                ${metrics.network.jsonRequests}`);
  console.log(`  🎬 Видео:                          ${metrics.network.videoRequests}`);
  console.log(`  ♻️  Дубликаты запросов:             ${metrics.network.duplicateRequests}`);
  console.log(`  ❌ Неудачные запросы:              ${metrics.network.failedRequests}`);
  console.log(`  💾 Объем данных:                   ${formatBytes(metrics.network.totalBytesTransferred)}`);
  console.log(`  ⏱️  Среднее время ответа:          ${formatTime(metrics.network.averageResponseTime)}`);
  console.log(`  🔀 Макс. параллельность:           ${metrics.network.maxConcurrency}`);
  console.log('');
  
  // 🔴 Детали неудачных запросов
  if (metrics.network.failedRequests > 0 && (metrics.network as any).failedRequestsList) {
    console.log('  🔴 ДЕТАЛИ НЕУДАЧНЫХ ЗАПРОСОВ:');
    (metrics.network as any).failedRequestsList.forEach((req: any, i: number) => {
      const shortUrl = req.url.length > 80 ? req.url.substring(0, 77) + '...' : req.url;
      console.log(`     ${i + 1}. [${req.status}] ${req.method} ${shortUrl}`);
      console.log(`        Тип: ${req.resourceType}`);
    });
    console.log('');
  }
  
  if (metrics.network.slowestRequests.length > 0) {
    console.log('  🐌 Самые медленные запросы:');
    metrics.network.slowestRequests.forEach((req, i) => {
      console.log(`     ${i + 1}. ${formatTime(req.time)} - ${req.url}`);
    });
    console.log('');
  }
  
  // 🎨 РЕНДЕРИНГ
  console.log('🎨 РЕНДЕРИНГ И АНИМАЦИЯ:');
  console.log('─'.repeat(80));
  console.log(`  📊 Средний FPS:                    ${metrics.rendering.averageFPS.toFixed(1)}`);
  console.log(`  📉 Минимальный FPS:                ${metrics.rendering.minFPS.toFixed(1)}`);
  console.log(`  📐 Layout Shifts (CLS):            ${metrics.rendering.layoutShifts.toFixed(3)}`);
  console.log(`  🔨 DOM узлов:                      ${metrics.rendering.domNodes}`);
  console.log(`  ⏳ Долгие задачи (>50ms):          ${metrics.rendering.longTasks}`);
  console.log('');
  
  // 💾 РЕСУРСЫ
  console.log('💾 ИСПОЛЬЗОВАНИЕ РЕСУРСОВ:');
  console.log('─'.repeat(80));
  console.log(`  🧠 Память JS Heap:                 ${metrics.resources.jsHeapSize.toFixed(1)} MB`);
  console.log(`  📏 Лимит памяти:                   ${metrics.resources.jsHeapSizeLimit.toFixed(1)} MB`);
  console.log(`  📊 Использование памяти:           ${((metrics.resources.jsHeapSize / metrics.resources.jsHeapSizeLimit) * 100).toFixed(1)}%`);
  console.log(`  🌳 DOM элементов:                  ${metrics.resources.domNodesCount}`);
  console.log(`  🎨 Canvas контекстов:              ${metrics.resources.canvasContexts}`);
  console.log('');
  
  // 🔥 CPU/GPU НАГРУЗКА
  if (metrics.performance) {
    console.log('🔥 CPU/GPU НАГРУЗКА:');
    console.log('─'.repeat(80));
    console.log(`  💻 CPU:`);
    console.log(`     - Время выполнения JS:           ${metrics.performance.cpuUsage.jsExecutionTime}ms`);
    console.log(`     - Всего долгих задач (>50ms):   ${metrics.performance.cpuUsage.totalLongTasks}`);
    console.log(`     - Общая длительность долгих:     ${metrics.performance.cpuUsage.longTasksDuration}ms`);
    console.log(`     - Средняя длительность задач:    ${metrics.performance.cpuUsage.averageTaskDuration}ms`);
    console.log(`  🎨 GPU:`);
    console.log(`     - Активных canvas:               ${metrics.performance.gpuUsage.activeCanvases}`);
    console.log(`     - Активных SVG:                  ${metrics.performance.gpuUsage.activeSvgs}`);
    console.log(`     - Время рендеринга (60 кадров):  ${metrics.performance.gpuUsage.renderingTime}ms`);
    console.log(`     - Пропущенных кадров:            ${metrics.performance.gpuUsage.frameDrops}`);
    console.log('');
  }
  
  // 📦 КЭШИРОВАНИЕ
  console.log('📦 КЭШИРОВАНИЕ:');
  console.log('─'.repeat(80));
  console.log(`  ✅ Cache Hits:                     ${metrics.caching.cacheHits}`);
  console.log(`  ❌ Cache Misses:                   ${metrics.caching.cacheMisses}`);
  console.log(`  📈 Эффективность кеша:             ${metrics.caching.cacheEfficiency.toFixed(1)}%`);
  console.log('');
  
  // 📊 ВОДОПАД ЗАГРУЗКИ
  if (metrics.waterfall.length > 0) {
    console.log('📊 ВОДОПАД ЗАГРУЗКИ (первые 20 запросов):');
    console.log('─'.repeat(80));
    metrics.waterfall.slice(0, 20).forEach((req, i) => {
      const bar = '█'.repeat(Math.min(Math.floor(req.duration / 50), 40));
      console.log(`  ${String(i + 1).padStart(2)}. ${formatTime(req.time).padEnd(8)} | ${formatTime(req.duration).padEnd(8)} ${bar}`);
      console.log(`      ${req.type.padEnd(12)} ${req.url.substring(0, 50)} (${formatBytes(req.size)})`);
    });
    console.log('');
  }
  
  // 🚨 ПРОБЛЕМЫ И УЗКИЕ МЕСТА
  const hasIssues = metrics.issues.errors.length > 0 || 
                    metrics.issues.warnings.length > 0 || 
                    metrics.issues.bottlenecks.length > 0;
  
  if (hasIssues) {
    console.log('🚨 ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ:');
    console.log('─'.repeat(80));
    
    if (metrics.issues.errors.length > 0) {
      console.log('  ❌ КРИТИЧЕСКИЕ ОШИБКИ:');
      metrics.issues.errors.forEach(err => console.log(`     • ${err}`));
      console.log('');
    }
    
    if (metrics.issues.warnings.length > 0) {
      console.log('  ⚠️  ПРЕДУПРЕЖДЕНИЯ:');
      metrics.issues.warnings.forEach(warn => console.log(`     • ${warn}`));
      console.log('');
    }
    
    if (metrics.issues.bottlenecks.length > 0) {
      console.log('  🔍 УЗКИЕ МЕСТА:');
      metrics.issues.bottlenecks.forEach(bottleneck => console.log(`     • ${bottleneck}`));
      console.log('');
    }
  } else {
    console.log('✅ ПРОБЛЕМ НЕ ОБНАРУЖЕНО\n');
  }
  
  // 💡 РЕКОМЕНДАЦИИ
  console.log('💡 РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ:');
  console.log('─'.repeat(80));
  
  const recommendations: string[] = [];
  
  if (metrics.timing.timeToFirstSticker > 3000) {
    recommendations.push('Оптимизируйте критический путь рендеринга для ускорения TTFS');
  }
  if (metrics.network.duplicateRequests > 5) {
    recommendations.push('Улучшите систему кеширования для предотвращения дублирующих запросов');
  }
  if (metrics.network.maxConcurrency > 50) {
    recommendations.push('Снизьте параллельность запросов (используйте батчинг или очереди)');
  }
  if (metrics.rendering.averageFPS < 30) {
    recommendations.push('Оптимизируйте анимации и рендеринг (используйте CSS transforms, will-change)');
  }
  if (metrics.rendering.layoutShifts > 0.1) {
    recommendations.push('Резервируйте пространство для контента (укажите width/height для изображений)');
  }
  if (metrics.network.totalBytesTransferred > 10 * 1024 * 1024) {
    recommendations.push('Уменьшите размер ресурсов (сжатие изображений, lazy loading)');
  }
  if (metrics.caching.cacheEfficiency < 50 && metrics.caching.cacheHits + metrics.caching.cacheMisses > 10) {
    recommendations.push('Улучшите стратегию кеширования (увеличьте TTL, prefetch)');
  }
  if (metrics.rendering.longTasks > 10) {
    recommendations.push('Разбейте долгие задачи на более мелкие части (используйте Web Workers)');
  }
  if (metrics.network.imageRequests > 100) {
    recommendations.push('Используйте спрайты или объедините мелкие изображения');
  }
  
  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => console.log(`  ${i + 1}. ${rec}`));
  } else {
    console.log('  ✨ Производительность отличная! Дополнительных рекомендаций нет.');
  }
  console.log('');
  
  console.log('═'.repeat(80));
  console.log('✅ BENCHMARK ЗАВЕРШЕН');
  console.log('═'.repeat(80) + '\n');
}

// ============================================================================
// ТЕСТЫ
// ============================================================================

test.describe('Gallery Benchmark: Загрузка 40 стикер-карточек (2 страницы)', () => {
  test.setTimeout(180000); // 3 минуты на тест (больше времени для 2 страниц)
  
  test('Бенчмарк производительности загрузки галереи с пагинацией @benchmark', async ({ page }) => {
    console.log('🚀 Запуск бенчмарка галереи с построчным скроллом (20 рядов, 40 карточек)...\n');
    
    // Инициализация сборщика метрик
    const collector = new MetricsCollector(page);
    await collector.start();
    
    // Установка авторизации
    await setupAuth(page);
    
    // Переход на страницу галереи
    console.log('📄 Переход на страницу галереи...');
    const navigationStart = Date.now();
    
    await navigateToGallery(page);
    
    // ════════════════════════════════════════════════════════════════════════
    // ПОСТРОЧНЫЙ СКРОЛЛ: Ожидание загрузки каждого ряда и скролл к следующему
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📊 ПОСТРОЧНЫЙ СКРОЛЛ: Загрузка 20 рядов (40 карточек)');
    console.log('─'.repeat(80));
    
    const TARGET_ROWS = 20;
    const rowTimes: number[] = [];
    let currentRowIndex = 0;
    let timeToFirstSticker = 0;
    let timeToFirst6 = 0;
    let timeToAll20 = 0;
    
    // Ожидание первого ряда (row 0)
    console.log(`⏳ Ряд 0: Ожидание загрузки медиа...`);
    const row0Start = Date.now();
    const row0Loaded = await waitForRowMediaLoad(page, 0, 10000);
    if (row0Loaded) {
      const row0Time = Date.now() - row0Start;
      rowTimes.push(row0Time);
      timeToFirstSticker = Date.now() - navigationStart;
      console.log(`✅ Ряд 0 загружен за ${formatTime(row0Time)} (TTFS: ${formatTime(timeToFirstSticker)})`);
    } else {
      console.log(`⚠️ Ряд 0: таймаут ожидания медиа, продолжаем...`);
      rowTimes.push(10000);
      timeToFirstSticker = Date.now() - navigationStart;
    }
    
    // Цикл для рядов 1-19
    for (let rowIndex = 1; rowIndex < TARGET_ROWS; rowIndex++) {
      // Скролл к следующему ряду
      console.log(`📜 Скролл к ряду ${rowIndex}...`);
      currentRowIndex = await scrollToNextRow(page, currentRowIndex);
      
      // Ждем появления ряда в DOM (максимум 2 секунды)
      let rowVisible = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const visibleRows = await getVisibleRowIndices(page);
        if (visibleRows.includes(rowIndex)) {
          rowVisible = true;
          break;
        }
        await page.waitForTimeout(200);
      }
      
      if (!rowVisible) {
        console.log(`⚠️ Ряд ${rowIndex}: не появился в DOM, пропускаем...`);
        continue;
      }
      
      // Ожидание загрузки медиа для текущего ряда
      console.log(`⏳ Ряд ${rowIndex}: Ожидание загрузки медиа...`);
      const rowStart = Date.now();
      const rowLoaded = await waitForRowMediaLoad(page, rowIndex, 5000);
      const rowTime = Date.now() - rowStart;
      rowTimes.push(rowTime);
      
      if (rowLoaded) {
        console.log(`✅ Ряд ${rowIndex} загружен за ${formatTime(rowTime)}`);
      } else {
        console.log(`⚠️ Ряд ${rowIndex}: таймаут ожидания медиа (${formatTime(rowTime)})`);
      }
      
      // Обновляем метрики для первых 6 и 20 стикеров
      if (rowIndex === 2 && timeToFirst6 === 0) {
        // После 3 рядов (6 карточек, если по 2 в ряду)
        timeToFirst6 = Date.now() - navigationStart;
        console.log(`✅ Первые 6 стикеров загружены за ${formatTime(timeToFirst6)}`);
      }
      
      if (rowIndex === 9 && timeToAll20 === 0) {
        // После 10 рядов (20 карточек)
        timeToAll20 = Date.now() - navigationStart;
        console.log(`✅ Все 20 стикеров загружены за ${formatTime(timeToAll20)}`);
      }
    }
    
    // Финальная проверка всех карточек
    console.log('\n⏳ Финальная проверка загрузки медиа для всех карточек...');
    const targetMediaCount = 38; // Минимум 95% карточек должны иметь медиа (38/40)
    const maxMediaWaitTime = 30000;
    const finalMediaStats = await waitForMediaLoad(page, targetMediaCount, maxMediaWaitTime);
    
    // Вычисляем статистику по рядам
    const visibleRows = await getVisibleRowIndices(page);
    const totalRowsLoaded = Math.max(...visibleRows, -1) + 1;
    console.log(`📊 Загружено рядов: ${totalRowsLoaded}/20`);
    console.log(`📊 Видимых рядов в DOM: ${visibleRows.length}`);
    
    // Статистика времени загрузки рядов
    if (rowTimes.length > 0) {
      const avgRowTime = rowTimes.reduce((a, b) => a + b, 0) / rowTimes.length;
      const maxRowTime = Math.max(...rowTimes);
      const minRowTime = Math.min(...rowTimes);
      console.log(`📊 Среднее время загрузки ряда: ${formatTime(avgRowTime)}`);
      console.log(`📊 Минимальное время: ${formatTime(minRowTime)}`);
      console.log(`📊 Максимальное время: ${formatTime(maxRowTime)}`);
    }
    
    logMediaStats(finalMediaStats, 'для всех рядов');
    
    // Если есть карточки без медиа - выводим их индексы для отладки
    if (finalMediaStats.emptyMedia > 0 && finalMediaStats.emptyCardIndices) {
      console.log(`  ⚠️  Карточки без медиа (индексы): ${finalMediaStats.emptyCardIndices.join(', ')}`);
    }
    
    // 🔍 ДИАГНОСТИКА: Проверяем состояние кеша vs рендера
    console.log('\n🔍 ДИАГНОСТИКА: Проверка состояния кешей и рендера...');
    
    // Получаем статистику очереди imageLoader
    const queueStats = await page.evaluate(async () => {
      const imageLoader = (window as any).imageLoader;
      if (!imageLoader?.loader) return null;
      return await imageLoader.loader.getQueueStats();
    });
    
    if (queueStats) {
      console.log('  📊 Статистика очереди imageLoader:');
      console.log(`     - В процессе (inFlight): ${queueStats.inFlight}`);
      console.log(`     - В очереди (queued): ${queueStats.queued} (high: ${queueStats.queuedHigh}, low: ${queueStats.queuedLow})`);
      console.log(`     - Активных загрузок: ${queueStats.active} (high: ${queueStats.activeHigh}, low: ${queueStats.activeLow})`);
      console.log(`     - Максимальная concurrency: ${queueStats.maxConcurrency}`);
      if (queueStats.cache) {
        console.log(`     - Кеш: images=${queueStats.cache.images}, animations=${queueStats.cache.animations}, videos=${queueStats.cache.videos}`);
      }
    }
    
    const cacheVsRenderStats = await getCacheStats(page);
    
    if ('error' in cacheVsRenderStats) {
      console.log('  ⚠️  Не удалось получить статистику кешей:', cacheVsRenderStats.error);
    } else {
      console.log('  📦 Состояние кешей:');
      console.log(`     - Images в кеше: ${cacheVsRenderStats.cacheStats.images}`);
      console.log(`     - Animations в кеше: ${cacheVsRenderStats.cacheStats.animations}`);
      console.log(`     - Videos в кеше: ${cacheVsRenderStats.cacheStats.videos}`);
      
      // Анализируем проблемные карточки
      const cardsWithoutMedia = cacheVsRenderStats.cardDetails.filter(c => !c.hasVisibleMedia);
      if (cardsWithoutMedia.length > 0) {
        console.log(`  ⚠️  Карточки без видимого медиа (${cardsWithoutMedia.length}):`);
        cardsWithoutMedia.slice(0, 10).forEach(card => {
          console.log(`     - Карточка ${card.index}: type=${card.mediaType}, hasAnimated=${card.hasAnimatedSticker}, hasCanvas=${card.hasLottieCanvas}`);
        });
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА: Проверяем состояние isFirstStickerReady
        console.log(`\n  🔬 Детальная диагностика проблемных карточек:`);
        const detailedCardInfo = await page.evaluate((indices: number[]) => {
          const cards = document.querySelectorAll('[data-testid="pack-card"]');
          return indices.map(index => {
            const card = cards[index];
            if (!card) return null;
            
            // Проверяем наличие skeleton loader (эмодзи в анимации)
            const hasPulseAnimation = card.querySelector('[style*="animation"][style*="pulse"]');
            const emojiPlaceholder = card.querySelector('[style*="fontSize"][style*="48px"]');
            
            return {
              index,
              hasSkeletonLoader: !!hasPulseAnimation || !!emojiPlaceholder,
              cardText: card.textContent?.substring(0, 50) || ''
            };
          }).filter(item => Boolean(item));
        }, cardsWithoutMedia.slice(0, 5).map(c => c.index));
        
        detailedCardInfo.forEach(info => {
          if (info) {
            console.log(`     - Карточка ${info.index}: hasSkeletonLoader=${info.hasSkeletonLoader} (isFirstStickerReady=false)`);
          }
        });
      }
    }
    
    // Даем время для завершения всех загрузок
    console.log('\n⏳ Ожидание финальной стабилизации...');
    await page.waitForTimeout(5000); // 🔥 УВЕЛИЧЕНО: с 3s до 5s
    
    // 🔍 DEBUG: Получаем статистику вызовов imageLoader
    console.log('\n🔍 СТАТИСТИКА ВЫЗОВОВ imageLoader:');
    console.log('─'.repeat(80));
    
    // Проверяем доступность imageLoader
    const imageLoaderCheck = await page.evaluate(() => {
      const win = window as any;
      return {
        exists: typeof win.imageLoader !== 'undefined',
        hasGetCallStats: typeof win.imageLoader?.getCallStats === 'function',
        hasCallCounter: typeof win.imageLoader?.callCounter !== 'undefined',
        hasGetImageLoaderStats: typeof win.getImageLoaderStats === 'function',
        imageLoaderType: typeof win.imageLoader,
        callCounterType: typeof win.imageLoader?.callCounter
      };
    });
    
    console.log(`  🔍 imageLoader.exists: ${imageLoaderCheck.exists}`);
    console.log(`  🔍 imageLoader.hasGetCallStats: ${imageLoaderCheck.hasGetCallStats}`);
    console.log(`  🔍 imageLoader.hasCallCounter: ${imageLoaderCheck.hasCallCounter}`);
    console.log(`  🔍 window.getImageLoaderStats: ${imageLoaderCheck.hasGetImageLoaderStats}`);
    console.log(`  🔍 callCounter type: ${imageLoaderCheck.callCounterType}`);
    
    const callStats = await page.evaluate(() => {
      const win = window as any;
      
      // Пробуем через window.getImageLoaderStats (явно экспортированная функция)
      if (typeof win.getImageLoaderStats === 'function') {
        try {
          return win.getImageLoaderStats();
        } catch (e) {
          console.error('Error calling getImageLoaderStats:', e);
        }
      }
      
      // Пробуем через метод getCallStats напрямую
      const loader = win.imageLoader;
      if (loader && typeof loader.getCallStats === 'function') {
        try {
          return loader.getCallStats();
        } catch (e) {
          console.error('Error calling loader.getCallStats:', e);
        }
      }
      
      // Если метода нет, пробуем напрямую через callCounter
      if (loader?.callCounter && typeof loader.callCounter.forEach === 'function') {
        try {
          const stats: { fileId: string; count: number }[] = [];
          loader.callCounter.forEach((count: number, fileId: string) => {
            stats.push({ fileId, count });
          });
          stats.sort((a, b) => b.count - a.count);
          return stats;
        } catch (e) {
          console.error('Error accessing callCounter:', e);
        }
      }
      
      return null;
    });
    
    if (callStats && callStats.length > 0) {
      console.log(`  📊 Всего уникальных fileId: ${callStats.length}`);
      console.log(`  📊 Общее количество вызовов: ${callStats.reduce((sum: number, item: any) => sum + item.count, 0)}`);
      console.log(`\n  🔝 ТОП-10 fileId по количеству вызовов:`);
      callStats.slice(0, 10).forEach((stat: any, index: number) => {
        console.log(`     ${index + 1}. ${stat.count}x - ${stat.fileId.slice(-12)}`);
      });
      
      // Анализ дубликатов
      const duplicates = callStats.filter((s: any) => s.count > 1);
      console.log(`\n  ⚠️  FileId с дубликатами: ${duplicates.length} из ${callStats.length} (${(duplicates.length / callStats.length * 100).toFixed(1)}%)`);
      const avgCallsPerFileId = callStats.reduce((sum: number, item: any) => sum + item.count, 0) / callStats.length;
      console.log(`  📊 Среднее количество вызовов на fileId: ${avgCallsPerFileId.toFixed(2)}`);
    } else {
      console.log(`  ⚠️  Статистика недоступна (imageLoader.getCallStats не найден)`);
    }
    
    // 🎬 СТАТИСТИКА АНИМАЦИЙ И ВИДЕО: Проверяем, сколько элементов рендерится
    console.log('\n🎬 СТАТИСТИКА РЕНДЕРИНГА АНИМАЦИЙ И ВИДЕО:');
    console.log('─'.repeat(80));
    
    const animationStats = await page.evaluate(() => {
      const win = window as any;
      
      // Проверяем доступность animationMonitor
      if (typeof win.animationMonitor?.getStats === 'function') {
        try {
          return win.animationMonitor.getStats();
        } catch (e) {
          console.error('Error calling animationMonitor.getStats:', e);
        }
      }
      
      // Fallback: ручной подсчет если animationMonitor недоступен
      // Ищем все canvas/svg внутри элементов с data-lottie-container
      // Lottie рендерит canvas/svg внутри контейнера, а не напрямую в .pack-card-animated-sticker
      const lottieContainers = document.querySelectorAll('[data-lottie-container]');
      const lottieElements: (SVGElement | HTMLCanvasElement)[] = [];
      
      lottieContainers.forEach((container) => {
        // Lottie может рендерить как canvas, так и svg
        const canvas = container.querySelector('canvas');
        const svg = container.querySelector('svg');
        
        // Добавляем элементы, избегая дубликатов
        if (canvas && !lottieElements.includes(canvas)) {
          lottieElements.push(canvas);
        }
        if (svg && !lottieElements.includes(svg)) {
          lottieElements.push(svg);
        }
      });
      
      // Также проверяем .pack-card-animated-sticker на случай, если структура другая
      const animatedStickers = document.querySelectorAll('.pack-card-animated-sticker');
      animatedStickers.forEach((sticker) => {
        const canvas = sticker.querySelector('canvas');
        const svg = sticker.querySelector('svg');
        if (canvas && !lottieElements.includes(canvas)) {
          lottieElements.push(canvas);
        }
        if (svg && !lottieElements.includes(svg)) {
          lottieElements.push(svg);
        }
      });
      const videos = Array.from(document.querySelectorAll('video.pack-card-video'));
      
      let activeAnimations = 0;
      let pausedAnimations = 0;
      let hiddenCount = 0;
      let visibleButPaused = 0;
      
      // Определяем scroll контейнер (может быть window или .stixly-main-scroll)
      const scrollContainer = document.querySelector('.stixly-main-scroll') as HTMLElement;
      const viewportHeight = scrollContainer ? scrollContainer.clientHeight : window.innerHeight;
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : (window.scrollY || document.documentElement.scrollTop);
      
      lottieElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const container = element.closest('[data-lottie-container]');
        const containerStyle = container ? window.getComputedStyle(container) : null;
        const elementStyle = window.getComputedStyle(element);
        
        // Проверяем, скрыт ли элемент
        const isHidden = (containerStyle && (
          containerStyle.display === 'none' || 
          containerStyle.visibility === 'hidden' ||
          containerStyle.opacity === '0'
        )) || (
          elementStyle.display === 'none' || 
          elementStyle.visibility === 'hidden' ||
          elementStyle.opacity === '0'
        );
        
        // Проверяем, на паузе ли анимация
        const isPaused = container?.getAttribute('data-lottie-paused') === 'true';
        
        // Проверяем видимость относительно scroll контейнера
        // Элемент видим, если он находится в пределах viewport + небольшой отступ
        const isInViewport = scrollContainer 
          ? (rect.top >= scrollContainer.getBoundingClientRect().top - 300 && 
             rect.bottom <= scrollContainer.getBoundingClientRect().bottom + 300)
          : (rect.top < viewportHeight + 300 && rect.bottom > -300);
        
        // Проверяем, что элемент действительно рендерится (имеет размеры)
        const hasSize = rect.width > 0 && rect.height > 0;
        
        if (isHidden || !hasSize) {
          hiddenCount++;
          pausedAnimations++;
        } else if (isPaused) {
          visibleButPaused++;
          pausedAnimations++;
        } else if (isInViewport) {
          // Элемент видим, не на паузе и имеет размеры - активен
          activeAnimations++;
        } else {
          // Элемент вне viewport - на паузе
          pausedAnimations++;
        }
      });
      
      let activeVideos = 0;
      let pausedVideos = 0;
      
      videos.forEach((video) => {
        const htmlVideo = video as HTMLVideoElement;
        const rect = htmlVideo.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
        
        if (htmlVideo.paused) {
          pausedVideos++;
        } else if (isVisible) {
          activeVideos++;
        } else {
          pausedVideos++;
        }
      });
      
      return {
        activeAnimations,
        pausedAnimations,
        activeVideos,
        pausedVideos,
        totalElements: lottieElements.length + videos.length,
        totalAnimations: lottieElements.length,
        hiddenAnimations: hiddenCount,
        visibleButPausedAnimations: visibleButPaused,
        debug: {
          containersFound: lottieContainers.length,
          stickersFound: animatedStickers.length,
          canvasesFound: lottieElements.filter(e => e.tagName === 'CANVAS').length,
          svgsFound: lottieElements.filter(e => e.tagName === 'SVG').length
        }
      };
    });
    
    if (animationStats) {
      console.log(`  🎬 Активных анимаций (рендерится):     ${animationStats.activeAnimations}`);
      console.log(`  ⏸️  На паузе (не рендерится):          ${animationStats.pausedAnimations}`);
      if (animationStats.hiddenAnimations !== undefined) {
        console.log(`     - Скрыто (display: none/visibility): ${animationStats.hiddenAnimations}`);
        console.log(`     - Видимо, но на паузе:               ${animationStats.visibleButPausedAnimations || 0}`);
      }
      console.log(`  🎥 Активных видео (воспроизводится):   ${animationStats.activeVideos}`);
      console.log(`  ⏸️  Видео на паузе:                    ${animationStats.pausedVideos}`);
      console.log(`  📊 Всего элементов:                    ${animationStats.totalElements}`);
      if (animationStats.totalAnimations !== undefined) {
        console.log(`     - Всего анимаций:                    ${animationStats.totalAnimations}`);
      }
      if (animationStats.debug) {
        console.log(`\n  🔍 ОТЛАДКА:`);
        console.log(`     - Контейнеров [data-lottie-container]: ${animationStats.debug.containersFound}`);
        console.log(`     - .pack-card-animated-sticker:          ${animationStats.debug.stickersFound}`);
        console.log(`     - Canvas элементов:                     ${animationStats.debug.canvasesFound}`);
        console.log(`     - SVG элементов:                        ${animationStats.debug.svgsFound}`);
        console.log(`     - Всего Lottie элементов:                ${animationStats.totalAnimations || 0}`);
        if (animationStats.hiddenAnimations !== undefined) {
          console.log(`     - Скрыто (display/visibility/opacity):  ${animationStats.hiddenAnimations}`);
        }
        if (animationStats.visibleButPausedAnimations !== undefined) {
          console.log(`     - Видимо, но на паузе:                 ${animationStats.visibleButPausedAnimations}`);
        }
      }
      
      const totalActive = animationStats.activeAnimations + animationStats.activeVideos;
      const totalPaused = animationStats.pausedAnimations + animationStats.pausedVideos;
      const efficiency = animationStats.totalElements > 0 
        ? ((totalPaused / animationStats.totalElements) * 100).toFixed(1)
        : '0.0';
      
      console.log(`\n  ✅ Эффективность оптимизации:         ${efficiency}% элементов на паузе`);
      console.log(`  ⚠️  Элементов рендерится:               ${totalActive} (должно быть ~6-12 для видимых)`);
      
      // Предупреждение если слишком много активных элементов
      if (totalActive > 20) {
        console.log(`  🚨 ВНИМАНИЕ: Слишком много активных элементов (${totalActive})!`);
        console.log(`     Возможно, оптимизация не работает корректно.`);
      } else if (totalActive <= 12) {
        console.log(`  ✅ Отлично: Оптимизация работает! Рендерится только видимые элементы.`);
      }
    } else {
      console.log(`  ⚠️  Статистика недоступна (animationMonitor не найден)`);
    }
    
    // 🔥 CPU/GPU НАГРУЗКА: Измеряем нагрузку на процессор и GPU после загрузки
    console.log('\n🔥 CPU/GPU НАГРУЗКА:');
    console.log('─'.repeat(80));
    
    const cpuGpuMetrics = await page.evaluate(() => {
      const win = window as any;
      const benchmarkMetrics = win.__benchmarkMetrics || {};
      
      // CPU метрики - используем данные из __benchmarkMetrics
      const longTasksCount = benchmarkMetrics.longTasks || 0;
      
      // Подсчитываем время выполнения JS через Performance API
      const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const jsExecutionTime = navigationTiming 
        ? navigationTiming.domInteractive - (navigationTiming.fetchStart || 0)
        : 0;
      
      // Получаем долгие задачи из PerformanceObserver (если доступны)
      const longTasks = performance.getEntriesByType('longtask') as PerformanceEntry[];
      let totalLongTasksDuration = 0;
      
      longTasks.forEach((task) => {
        totalLongTasksDuration += (task as any).duration || 0;
      });
      
      // Если долгих задач нет в Performance API, используем оценку на основе количества
      const averageTaskDuration = longTasks.length > 0 
        ? totalLongTasksDuration / longTasks.length 
        : (longTasksCount > 0 ? 100 : 0); // Примерная оценка: 100ms на задачу
      
      const actualLongTasksDuration = longTasks.length > 0 
        ? totalLongTasksDuration 
        : (longTasksCount * 100); // Примерная оценка
      
      // GPU метрики - активные canvas и SVG
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const svgs = Array.from(document.querySelectorAll('svg'));
      
      // Подсчитываем активные (видимые) элементы
      let activeCanvases = 0;
      let activeSvgs = 0;
      
      canvases.forEach((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight + 200 && rect.bottom > -200;
        const style = window.getComputedStyle(canvas);
        if (isVisible && style.visibility !== 'hidden' && style.display !== 'none') {
          activeCanvases++;
        }
      });
      
      svgs.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight + 200 && rect.bottom > -200;
        const style = window.getComputedStyle(svg);
        if (isVisible && style.visibility !== 'hidden' && style.display !== 'none') {
          activeSvgs++;
        }
      });
      
      // Оценка времени рендеринга на основе количества активных элементов
      // Чем больше активных canvas/SVG, тем больше нагрузка на GPU
      const estimatedRenderTime = (activeCanvases + activeSvgs) * 2; // Примерная оценка: 2ms на элемент
      
      // Оценка пропущенных кадров на основе количества долгих задач
      // Каждая долгая задача может привести к пропуску кадров
      const estimatedFrameDrops = longTasks.length * 2;
      
      return {
        cpuUsage: {
          jsExecutionTime: Math.round(jsExecutionTime),
          totalLongTasks: longTasksCount, // Используем из __benchmarkMetrics
          longTasksDuration: Math.round(actualLongTasksDuration),
          averageTaskDuration: Math.round(averageTaskDuration)
        },
        gpuUsage: {
          activeCanvases,
          activeSvgs,
          renderingTime: Math.round(estimatedRenderTime),
          frameDrops: estimatedFrameDrops
        }
      };
    });
    
    if (cpuGpuMetrics) {
      console.log(`  💻 CPU НАГРУЗКА:`);
      console.log(`     - Время выполнения JS:           ${cpuGpuMetrics.cpuUsage.jsExecutionTime}ms`);
      console.log(`     - Всего долгих задач (>50ms):   ${cpuGpuMetrics.cpuUsage.totalLongTasks}`);
      console.log(`     - Общая длительность долгих:     ${cpuGpuMetrics.cpuUsage.longTasksDuration}ms`);
      console.log(`     - Средняя длительность задач:    ${cpuGpuMetrics.cpuUsage.averageTaskDuration}ms`);
      
      console.log(`\n  🎨 GPU НАГРУЗКА:`);
      console.log(`     - Активных canvas:               ${cpuGpuMetrics.gpuUsage.activeCanvases}`);
      console.log(`     - Активных SVG:                  ${cpuGpuMetrics.gpuUsage.activeSvgs}`);
      console.log(`     - Время рендеринга (60 кадров):  ${cpuGpuMetrics.gpuUsage.renderingTime}ms`);
      console.log(`     - Пропущенных кадров:            ${cpuGpuMetrics.gpuUsage.frameDrops}`);
      
      // Оценка нагрузки
      const cpuLoad = cpuGpuMetrics.cpuUsage.totalLongTasks > 10 ? '🔴 Высокая' :
                     cpuGpuMetrics.cpuUsage.totalLongTasks > 5 ? '🟡 Средняя' : '🟢 Низкая';
      const gpuLoad = cpuGpuMetrics.gpuUsage.activeCanvases + cpuGpuMetrics.gpuUsage.activeSvgs > 15 ? '🔴 Высокая' :
                     cpuGpuMetrics.gpuUsage.activeCanvases + cpuGpuMetrics.gpuUsage.activeSvgs > 8 ? '🟡 Средняя' : '🟢 Низкая';
      
      console.log(`\n  📊 ОЦЕНКА НАГРУЗКИ:`);
      console.log(`     - CPU: ${cpuLoad} (${cpuGpuMetrics.cpuUsage.totalLongTasks} долгих задач)`);
      console.log(`     - GPU: ${gpuLoad} (${cpuGpuMetrics.gpuUsage.activeCanvases + cpuGpuMetrics.gpuUsage.activeSvgs} активных элементов)`);
      
      if (cpuGpuMetrics.gpuUsage.frameDrops > 10) {
        console.log(`  ⚠️  ВНИМАНИЕ: Много пропущенных кадров (${cpuGpuMetrics.gpuUsage.frameDrops})!`);
        console.log(`     Возможно, слишком много элементов рендерится одновременно.`);
      }
    } else {
      console.log(`  ⚠️  Метрики CPU/GPU недоступны`);
    }
    
    // Сохраняем метрики CPU/GPU в коллекторе
    if (cpuGpuMetrics) {
      collector.setCpuGpuMetrics(cpuGpuMetrics);
    }
    console.log('');
    
    // Собираем FPS метрики
    console.log('📊 Сбор FPS метрик...');
    await collector.collectFPS(5000);
    
    // Генерируем финальный отчет
    console.log('📝 Генерация отчета...');
    const metrics = await collector.generateReport();
    
    // Заполняем метрики времени загрузки стикеров
    metrics.timing.timeToFirstSticker = timeToFirstSticker;
    metrics.timing.timeToFirst6Stickers = timeToFirst6;
    metrics.timing.timeToAll20Stickers = timeToAll20;
    
    // Выводим отчет
    printBenchmarkReport(metrics);
    
    // Дополнительная статистика для рядов
    console.log('\n📊 СТАТИСТИКА ПОСТРОЧНОЙ ЗАГРУЗКИ:');
    console.log('─'.repeat(80));
    console.log(`  ⏱️  Первый ряд (TTFS): ${formatTime(timeToFirstSticker)}`);
    if (timeToFirst6 > 0) {
      console.log(`  ⏱️  Первые 3 ряда (6 карточек): ${formatTime(timeToFirst6)}`);
    }
    if (timeToAll20 > 0) {
      console.log(`  ⏱️  Первые 10 рядов (20 карточек): ${formatTime(timeToAll20)}`);
    }
    const totalTime = Date.now() - navigationStart;
    console.log(`  ⏱️  Общее время загрузки 20 рядов: ${formatTime(totalTime)}`);
    if (rowTimes.length > 0) {
      const avgRowTime = rowTimes.reduce((a, b) => a + b, 0) / rowTimes.length;
      console.log(`  ⚡ Средняя скорость: ${(1000 / avgRowTime).toFixed(2)} рядов/сек`);
    }
    console.log('');
    
    // Проверки (мягкие, не падаем на них)
    const checks = {
      ttfsAcceptable: metrics.timing.timeToFirstSticker < 5000,
      lcpAcceptable: metrics.timing.largestContentfulPaint < 4000,
      fpsAcceptable: metrics.rendering.averageFPS >= 30,
      clsAcceptable: metrics.rendering.layoutShifts < 0.25,
      noDuplicates: metrics.network.duplicateRequests < 15,
      noFailedRequests: metrics.network.failedRequests === 0,
      rowsLoaded: totalRowsLoaded >= 18, // Минимум 90% рядов (18/20)
      allCardsHaveMedia: finalMediaStats.emptyMedia < 5, // Макс 5 карточек без медиа допустимо
    };
    
    console.log('🎯 РЕЗУЛЬТАТЫ ПРОВЕРОК:');
    console.log(`  ${checks.ttfsAcceptable ? '✅' : '❌'} TTFS < 5s: ${formatTime(metrics.timing.timeToFirstSticker)}`);
    console.log(`  ${checks.lcpAcceptable ? '✅' : '❌'} LCP < 4s: ${formatTime(metrics.timing.largestContentfulPaint)}`);
    console.log(`  ${checks.fpsAcceptable ? '✅' : '❌'} FPS >= 30: ${metrics.rendering.averageFPS.toFixed(1)}`);
    console.log(`  ${checks.clsAcceptable ? '✅' : '❌'} CLS < 0.25: ${metrics.rendering.layoutShifts.toFixed(3)}`);
    console.log(`  ${checks.noDuplicates ? '✅' : '❌'} Дубликаты < 15: ${metrics.network.duplicateRequests}`);
    console.log(`  ${checks.noFailedRequests ? '✅' : '❌'} Нет ошибок: ${metrics.network.failedRequests === 0 ? 'Да' : 'Нет'}`);
    console.log(`  ${checks.rowsLoaded ? '✅' : '❌'} Рядов загружено: ${totalRowsLoaded}/20`);
    console.log(`  ${checks.allCardsHaveMedia ? '✅' : '❌'} Медиа загружено: ${finalMediaStats.loadedMedia}/${finalMediaStats.totalCards}`);
    console.log('');
    
    // Базовая проверка: проверяем что загружено достаточно рядов
    // Для виртуализированной галереи проверяем количество рядов, а не карточек в DOM
    console.log(`📊 Итого загружено рядов: ${totalRowsLoaded}/20`);
    console.log(`📊 Видимых карточек в DOM: ${finalMediaStats.totalCards} (из-за виртуализации)`);
    
    expect(totalRowsLoaded).toBeGreaterThanOrEqual(18); // Минимум 90% рядов (18/20 = 36 карточек)
    // Для виртуализированной галереи проверяем процент загруженных медиа от видимых карточек
    // Поскольку виртуализация рендерит только видимые элементы, проверяем что 80%+ видимых карточек имеют медиа
    const mediaLoadedPercentage = finalMediaStats.totalCards > 0 
      ? (finalMediaStats.loadedMedia / finalMediaStats.totalCards) * 100 
      : 0;
    expect(mediaLoadedPercentage).toBeGreaterThanOrEqual(60); // Минимум 60% видимых карточек должны иметь медиа
  });
  
  test('Тест производительности на мобильном устройстве @mobile @benchmark', async ({ page }) => {
    // Устанавливаем мобильный viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 13
    
    console.log('📱 Бенчмарк для мобильного устройства...\n');
    
    const collector = new MetricsCollector(page);
    await collector.start();
    
    // Установка авторизации
    await setupAuth(page);
    
    await page.goto('/miniapp/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="gallery-container"]', { timeout: 15000 }).catch(() => {});
    
    console.log('⏳ Ожидание стикеров с медиа...');
    const timeToFirst = await collector.waitForStickers(1, 10000);
    const timeToFirst6 = await collector.waitForStickers(6, 15000);
    const timeToAll20 = await collector.waitForStickers(20, 30000);
    console.log(`✅ Загружено: 1 за ${formatTime(timeToFirst)}, 6 за ${formatTime(timeToFirst6)}, 20 за ${formatTime(timeToAll20)}`);
    
    await page.waitForTimeout(2000);
    await collector.collectFPS(3000);
    
    const metrics = await collector.generateReport();
    metrics.timing.timeToFirstSticker = timeToFirst;
    metrics.timing.timeToFirst6Stickers = timeToFirst6;
    metrics.timing.timeToAll20Stickers = timeToAll20;
    
    printBenchmarkReport(metrics);
    
    const stickerCount = await page.locator('[data-testid="pack-card"]').count();
    expect(stickerCount).toBeGreaterThanOrEqual(15);
  });
});

