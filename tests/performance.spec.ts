import { test, expect } from '@playwright/test';

/**
 * LottieOptimizationAgent - Performance Test Report
 * 
 * Тест производительности системы загрузки и ротации стикеров
 * Только измерение, без оптимизации
 */

interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  timestamp: number;
  responseTime?: number;
  status?: number;
  size?: number;
}

interface PerformanceMetrics {
  loadingMetrics: {
    firstVisibleStickerTime: number;
    allVisibleStickersTime: number;
    requestsBeforeScroll: number;
    totalRequestsFirst20s: number;
    imageRequests: number;
    jsonRequests: number;
    duplicateRequests: number;
    viewportCapacity: number;
    animatedVisible: number;
    staticVisible: number;
  };
  runtimeMetrics: {
    fpsIdle: number[];
    fpsScrolling: number[];
    fpsRotation: number[];
    memoryInitial: number;
    memoryAfter30s: number;
    domNodesInitial: number;
    domNodesAfterScroll: number;
  };
  cachingMetrics: {
    cacheHits: number;
    networkLoads: number;
    cachePreventedRepeats: boolean;
    requestsDecreasedAfterRotation: boolean;
  };
  errors: string[];
  requestTimeline: Array<{ time: number; type: string; url: string }>;
  maxConcurrency: number;
  concurrencySpikes: Array<{ time: number; count: number; cause: string }>;
}

const isStickerAssetUrl = (url: string): boolean =>
  url.includes('/stickers/');

test.describe('Performance Metrics Collection', () => {
  test('Сбор метрик производительности галереи стикеров @mobile', async ({ page }) => {
    // Увеличиваем таймаут для этого теста до 3 минут
    test.setTimeout(180000);
    
    // Используем мобильный viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    const metrics: PerformanceMetrics = {
      loadingMetrics: {
        firstVisibleStickerTime: 0,
        allVisibleStickersTime: 0,
        requestsBeforeScroll: 0,
        totalRequestsFirst20s: 0,
        imageRequests: 0,
        jsonRequests: 0,
        duplicateRequests: 0,
        viewportCapacity: 0,
        animatedVisible: 0,
        staticVisible: 0,
      },
      runtimeMetrics: {
        fpsIdle: [],
        fpsScrolling: [],
        fpsRotation: [],
        memoryInitial: 0,
        memoryAfter30s: 0,
        domNodesInitial: 0,
        domNodesAfterScroll: 0,
      },
      cachingMetrics: {
        cacheHits: 0,
        networkLoads: 0,
        cachePreventedRepeats: false,
        requestsDecreasedAfterRotation: false,
      },
      errors: [],
      requestTimeline: [],
      maxConcurrency: 0,
      concurrencySpikes: [],
    };

    // Счётчики для отслеживания
    const networkRequests: NetworkRequest[] = [];
    const requestTimes = new Map<string, number[]>();
    let currentConcurrency = 0;
    let maxConcurrency = 0;
    const activeRequests = new Set<string>();
    let scrollStarted = false;
    let rotationStarted = false;

    // ==================== NETWORK MONITORING ====================
    
    page.on('request', request => {
      const timestamp = Date.now();
      const url = request.url();
      
      // Отслеживание дубликатов
      if (requestTimes.has(url)) {
        requestTimes.get(url)!.push(timestamp);
      } else {
        requestTimes.set(url, [timestamp]);
      }
      
      // Определение типа ресурса
      const resourceType = request.resourceType();
      const isImage = resourceType === 'image' || isStickerAssetUrl(url) || url.endsWith('.webp') || url.endsWith('.png');
      const isJson = url.endsWith('.json') || resourceType === 'fetch';
      
      networkRequests.push({
        url,
        method: request.method(),
        resourceType,
        timestamp,
      });
      
      activeRequests.add(url);
      currentConcurrency++;
      if (currentConcurrency > maxConcurrency) {
        maxConcurrency = currentConcurrency;
      }
    });
    
    page.on('response', response => {
      const timestamp = Date.now();
      const url = response.url();
      const status = response.status();
      
      // Находим соответствующий request
      const request = networkRequests.find(r => r.url === url && !r.responseTime);
      if (request) {
        request.responseTime = timestamp - request.timestamp;
        request.status = status;
        // Note: size calculation is too expensive, removed
        request.size = 0;
      }
      
      activeRequests.delete(url);
      currentConcurrency--;
      
      // Логируем ошибки
      if (status >= 400) {
        metrics.errors.push(`HTTP ${status} on ${url}`);
      }
    });

    page.on('requestfailed', request => {
      metrics.errors.push(`Failed to load: ${request.url()}`);
    });

    // ==================== CONSOLE ERROR LOGGING ====================
    
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        metrics.errors.push(`Console error: ${text}`);
      }
      
      // Отслеживание кеширования из логов
      if (text.includes('Loaded from cache:')) {
        metrics.cachingMetrics.cacheHits++;
      }
      if (text.includes('Prefetched animation:') || text.includes('Image loaded for')) {
        metrics.cachingMetrics.networkLoads++;
      }
    });

    // ==================== FPS MONITORING ====================
    
    const fpsSamples: Array<{ fps: number; timestamp: number; state: 'idle' | 'scrolling' | 'rotating' }> = [];
    
    await page.addInitScript(() => {
      (window as any).__performanceMetrics = {
        fps: 0,
        lastTime: performance.now(),
        frameCount: 0,
      };
      
      function measureFPS() {
        const now = performance.now();
        const metrics = (window as any).__performanceMetrics;
        metrics.frameCount++;
        
        if (now - metrics.lastTime >= 1000) {
          const fps = metrics.frameCount / ((now - metrics.lastTime) / 1000);
          metrics.fps = fps;
          metrics.frameCount = 0;
          metrics.lastTime = now;
        }
        
        requestAnimationFrame(measureFPS);
      }
      
      requestAnimationFrame(measureFPS);
    });

    // Функция чтения FPS из браузера
    const readFPS = async (state: 'idle' | 'scrolling' | 'rotating'): Promise<number> => {
      const fps = await page.evaluate(() => (window as any).__performanceMetrics?.fps || 0);
      fpsSamples.push({ fps, timestamp: Date.now(), state });
      return fps;
    };

    // ==================== NAVIGATION & INITIAL LOAD ====================
    
    console.log('📊 [METRICS] Starting navigation...');
    const navigationStart = Date.now();
    
    await page.goto('/miniapp/', { waitUntil: 'domcontentloaded' });
    
    console.log('📊 [METRICS] Waiting for gallery to load...');
    await page.waitForSelector('[data-testid="gallery-container"]', { timeout: 15000 }).catch(() => {
      console.log('📊 [METRICS] Gallery container not found, trying pack-card...');
    });
    
    await page.waitForSelector('[data-testid="pack-card"]', { timeout: 15000 }).catch(() => {
      console.log('📊 [METRICS] No pack cards found!');
    });
    
    // Первый видимый стикер
    const firstStickerVisible = await page.locator('[data-testid="sticker-preview"]').first().isVisible({ timeout: 10000 })
      .catch(() => false);
    
    if (firstStickerVisible) {
      metrics.loadingMetrics.firstVisibleStickerTime = Date.now() - navigationStart;
      console.log(`✅ [METRICS] First sticker visible at ${metrics.loadingMetrics.firstVisibleStickerTime}ms`);
    }

    // Ждём немного для загрузки остальных стикеров
    await page.waitForTimeout(2000);
    
    const allVisibleStickers = await page.locator('[data-testid="sticker-preview"]').all();
    metrics.loadingMetrics.allVisibleStickersTime = Date.now() - navigationStart;
    console.log(`✅ [METRICS] All visible stickers count: ${allVisibleStickers.length}`);

    // DOM nodes count
    metrics.runtimeMetrics.domNodesInitial = await page.evaluate(() => document.querySelectorAll('*').length);
    
    // Memory usage
    metrics.runtimeMetrics.memoryInitial = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // ==================== IDLE PHASE (20 seconds) ====================
    
    console.log('📊 [METRICS] Starting 20s idle phase...');
    const idleStart = Date.now();
    const idleEnd = idleStart + 20000;
    
    while (Date.now() < idleEnd) {
      await readFPS('idle');
      await page.waitForTimeout(1000);
    }
    
    metrics.runtimeMetrics.fpsIdle = fpsSamples.filter(s => s.state === 'idle').map(s => s.fps);

    // Count visible sticker types
    const visiblePacks = await page.locator('[data-testid="pack-card"]:visible').count();
    console.log(`✅ [METRICS] Visible packs: ${visiblePacks}`);
    metrics.loadingMetrics.viewportCapacity = visiblePacks;

    // ==================== SCROLL PHASE ====================
    
    console.log('📊 [METRICS] Starting scroll phase...');
    scrollStarted = true;
    
    const requestsBeforeScroll = networkRequests.length;
    metrics.loadingMetrics.requestsBeforeScroll = requestsBeforeScroll;
    
    // Scroll down
    await page.evaluate(() => {
      window.scrollTo({ top: 10000, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);
    
    while (await page.evaluate(() => window.scrollY < 5000)) {
      await readFPS('scrolling');
      await page.waitForTimeout(500);
    }
    
    // Scroll up
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);
    
    while (await page.evaluate(() => window.scrollY > 100)) {
      await readFPS('scrolling');
      await page.waitForTimeout(500);
    }
    
    metrics.runtimeMetrics.fpsScrolling = fpsSamples.filter(s => s.state === 'scrolling').map(s => s.fps);
    metrics.runtimeMetrics.domNodesAfterScroll = await page.evaluate(() => document.querySelectorAll('*').length);

    // ==================== INTERACTION PHASE ====================
    
    console.log('📊 [METRICS] Starting interaction phase...');
    rotationStarted = true;
    
    // Hover over a pack
    const firstPack = page.locator('[data-testid="pack-card"]').first();
    await firstPack.hover();
    await page.waitForTimeout(3000);
    
    while (metrics.runtimeMetrics.fpsRotation.length < 10) {
      await readFPS('rotating');
      await page.waitForTimeout(500);
    }
    
    // Click to open pack
    await firstPack.click();
    await page.waitForTimeout(2000);
    
    // Go back
    const backButton = page.locator('button:has-text("Back"), button:has-text("Назад")').first();
    if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backButton.click();
    } else {
      await page.goBack();
    }
    
    await page.waitForTimeout(2000);

    // ==================== FINAL METRICS ====================
    
    metrics.runtimeMetrics.memoryAfter30s = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // ==================== REQUEST ANALYSIS ====================
    
    const totalRequestsFirst20s = networkRequests.filter(r => r.timestamp < navigationStart + 20000).length;
    metrics.loadingMetrics.totalRequestsFirst20s = totalRequestsFirst20s;
    
    // Separate image vs JSON
    networkRequests.forEach(req => {
      if (req.resourceType === 'image' || isStickerAssetUrl(req.url)) {
        metrics.loadingMetrics.imageRequests++;
      } else if (req.url.endsWith('.json')) {
        metrics.loadingMetrics.jsonRequests++;
      }
    });
    
    // Duplicate requests
    let duplicates = 0;
    requestTimes.forEach((times, url) => {
      if (times.length > 1) {
        duplicates += times.length - 1;
      }
    });
    metrics.loadingMetrics.duplicateRequests = duplicates;
    
    // Timeline
    networkRequests.slice(0, 100).forEach(req => {
      metrics.requestTimeline.push({
        time: req.timestamp - navigationStart,
        type: req.resourceType,
        url: req.url.substring(req.url.lastIndexOf('/') + 1),
      });
    });
    
    // Max concurrency
    metrics.maxConcurrency = maxConcurrency;

    // ==================== CACHE ANALYSIS ====================
    
    // Check if same URLs are requested multiple times
    metrics.cachingMetrics.cachePreventedRepeats = duplicates === 0;
    
    // Check if requests decrease after rotation
    const requestsDuringRotation = networkRequests.filter(r => r.timestamp > idleEnd).length;
    const avgRequestsPerSec = requestsDuringRotation / 10;
    const avgRequestsPerSecInitial = totalRequestsFirst20s / 20;
    metrics.cachingMetrics.requestsDecreasedAfterRotation = avgRequestsPerSec < avgRequestsPerSecInitial;

    // ==================== REPORT GENERATION ====================
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 PERFORMANCE TEST REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary
    console.log('✅ SUMMARY:');
    console.log(`  • First sticker visible: ${metrics.loadingMetrics.firstVisibleStickerTime}ms`);
    console.log(`  • All visible stickers: ${metrics.loadingMetrics.allVisibleStickersTime}ms`);
    console.log(`  • Total requests (first 20s): ${metrics.loadingMetrics.totalRequestsFirst20s}`);
    console.log(`  • Duplicate requests: ${duplicates}`);
    console.log(`  • Max concurrency: ${maxConcurrency}`);
    console.log(`  • Errors encountered: ${metrics.errors.length}`);
    console.log('\n');

    // Metrics Table
    console.log('✅ METRICS TABLE:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('LOADING METRICS:');
    console.log(`  First visible sticker (ms):      ${metrics.loadingMetrics.firstVisibleStickerTime.toFixed(0)}`);
    console.log(`  All visible stickers (ms):       ${metrics.loadingMetrics.allVisibleStickersTime.toFixed(0)}`);
    console.log(`  Requests before scroll:          ${metrics.loadingMetrics.requestsBeforeScroll}`);
    console.log(`  Total requests (20s):            ${metrics.loadingMetrics.totalRequestsFirst20s}`);
    console.log(`  Image requests:                  ${metrics.loadingMetrics.imageRequests}`);
    console.log(`  JSON requests:                   ${metrics.loadingMetrics.jsonRequests}`);
    console.log(`  Duplicate requests:              ${metrics.loadingMetrics.duplicateRequests}`);
    console.log(`  Viewport capacity (packs):       ${metrics.loadingMetrics.viewportCapacity}`);
    console.log(`  Animated visible:                ${metrics.loadingMetrics.animatedVisible}`);
    console.log(`  Static visible:                  ${metrics.loadingMetrics.staticVisible}`);
    console.log('');
    console.log('RUNTIME METRICS:');
    const avgFPSIdle = metrics.runtimeMetrics.fpsIdle.length > 0 
      ? (metrics.runtimeMetrics.fpsIdle.reduce((a, b) => a + b, 0) / metrics.runtimeMetrics.fpsIdle.length).toFixed(1)
      : 'N/A';
    const avgFPSScroll = metrics.runtimeMetrics.fpsScrolling.length > 0
      ? (metrics.runtimeMetrics.fpsScrolling.reduce((a, b) => a + b, 0) / metrics.runtimeMetrics.fpsScrolling.length).toFixed(1)
      : 'N/A';
    const avgFPSRotate = metrics.runtimeMetrics.fpsRotation.length > 0
      ? (metrics.runtimeMetrics.fpsRotation.reduce((a, b) => a + b, 0) / metrics.runtimeMetrics.fpsRotation.length).toFixed(1)
      : 'N/A';
    console.log(`  FPS idle:                       ${avgFPSIdle}`);
    console.log(`  FPS scrolling:                  ${avgFPSScroll}`);
    console.log(`  FPS rotation:                   ${avgFPSRotate}`);
    console.log(`  Memory initial (MB):            ${(metrics.runtimeMetrics.memoryInitial / 1024 / 1024).toFixed(1)}`);
    console.log(`  Memory after 30s (MB):          ${(metrics.runtimeMetrics.memoryAfter30s / 1024 / 1024).toFixed(1)}`);
    console.log(`  Memory delta (MB):              ${((metrics.runtimeMetrics.memoryAfter30s - metrics.runtimeMetrics.memoryInitial) / 1024 / 1024).toFixed(1)}`);
    console.log(`  DOM nodes initial:              ${metrics.runtimeMetrics.domNodesInitial}`);
    console.log(`  DOM nodes after scroll:         ${metrics.runtimeMetrics.domNodesAfterScroll}`);
    console.log(`  DOM nodes delta:                ${metrics.runtimeMetrics.domNodesAfterScroll - metrics.runtimeMetrics.domNodesInitial}`);
    console.log('');
    console.log('CACHING METRICS:');
    console.log(`  Cache hits:                     ${metrics.cachingMetrics.cacheHits}`);
    console.log(`  Network loads:                  ${metrics.cachingMetrics.networkLoads}`);
    console.log(`  Cache prevents repeats:         ${metrics.cachingMetrics.cachePreventedRepeats ? '✅' : '❌'}`);
    console.log(`  Requests decrease after rotate: ${metrics.cachingMetrics.requestsDecreasedAfterRotation ? '✅' : '❌'}`);
    console.log('');
    console.log('NETWORK METRICS:');
    console.log(`  Max concurrency:                ${metrics.maxConcurrency}`);
    console.log('');
    console.log('─────────────────────────────────────────────────────────\n');

    // Timeline (first 20 requests)
    console.log('✅ TIMELINE (first 20 requests):');
    console.log('─────────────────────────────────────────────────────────');
    metrics.requestTimeline.slice(0, 20).forEach(req => {
      console.log(`  ${req.time.toFixed(0)}ms - ${req.type}: ${req.url.substring(0, 50)}`);
    });
    console.log('─────────────────────────────────────────────────────────\n');

    // Errors
    if (metrics.errors.length > 0) {
      console.log('❌ PROBLEMS DETECTED:');
      console.log('─────────────────────────────────────────────────────────');
      metrics.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.substring(0, 80)}`);
      });
      console.log('─────────────────────────────────────────────────────────\n');
    } else {
      console.log('✅ PROBLEMS DETECTED: None\n');
    }

    // Logs
    console.log('✅ LOGS:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  Total network requests: ${networkRequests.length}`);
    console.log(`  Failed requests: ${networkRequests.filter(r => r.status && r.status >= 400).length}`);
    console.log(`  Average response time: ${networkRequests.filter(r => r.responseTime).length > 0 ? (networkRequests.filter(r => r.responseTime).reduce((sum, r) => sum + (r.responseTime || 0), 0) / networkRequests.filter(r => r.responseTime).length).toFixed(0) : 'N/A'}ms`);
    console.log('─────────────────────────────────────────────────────────\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ REPORT COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Assertions (warning only, not failing)
    if (metrics.loadingMetrics.firstVisibleStickerTime > 5000) {
      console.log('⚠️  WARNING: First sticker visible time is high (>5s)');
    }
    
    if (parseFloat(avgFPSIdle) < 30) {
      console.log('⚠️  WARNING: Idle FPS is low (<30)');
    }
    
    if (metrics.errors.length > 0) {
      console.log(`⚠️  WARNING: ${metrics.errors.length} errors detected`);
    }
    
    if (duplicates > 0) {
      console.log(`⚠️  WARNING: ${duplicates} duplicate requests detected`);
    }
  });
});

