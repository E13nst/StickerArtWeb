/**
 * Performance Monitoring утилита
 * Отслеживает Web Vitals и кастомные метрики
 */

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  timestamp: number;
  userAgent: string;
  connection?: {
    effectiveType?: string;
    rtt?: number;
    downlink?: number;
    saveData?: boolean;
  };
}

type MetricCallback = (metric: PerformanceMetric) => void;

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private callbacks: Set<MetricCallback> = new Set();
  private isInitialized = false;

  /**
   * Инициализирует мониторинг Web Vitals
   */
  initialize() {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.isInitialized = true;

    // FCP - First Contentful Paint
    this.observeFCP();

    // LCP - Largest Contentful Paint
    this.observeLCP();

    // FID - First Input Delay
    this.observeFID();

    // CLS - Cumulative Layout Shift
    this.observeCLS();

    // Custom metrics
    this.observeCustomMetrics();

    console.log('📊 Performance Monitor initialized');
  }

  /**
   * Регистрирует callback для новых метрик
   */
  onMetric(callback: MetricCallback) {
    this.callbacks.add(callback);
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Записывает метрику
   */
  private recordMetric(metric: PerformanceMetric) {
    this.metrics.set(metric.name, metric);
    
    // Вызываем все зарегистрированные callbacks
    this.callbacks.forEach(callback => callback(metric));

    // Логируем только в development
    if (import.meta.env.DEV) {
      const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
      console.log(`${emoji} ${metric.name}: ${metric.value.toFixed(2)}ms [${metric.rating}]`);
    }
  }

  /**
   * Возвращает все собранные метрики
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Генерирует отчет для отправки на бэкенд
   */
  generateReport(): PerformanceReport {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    return {
      metrics: this.getMetrics(),
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      connection: connection ? {
        effectiveType: connection.effectiveType,
        rtt: connection.rtt,
        downlink: connection.downlink,
        saveData: connection.saveData
      } : undefined
    };
  }

  /**
   * Отправляет отчет на бэкенд (опционально)
   */
  async sendReport(endpoint?: string) {
    if (!endpoint) {
      console.warn('⚠️ Performance report endpoint not configured');
      return;
    }

    const report = this.generateReport();

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      console.log('📊 Performance report sent');
    } catch (error) {
      console.warn('Failed to send performance report:', error);
    }
  }

  /**
   * FCP - First Contentful Paint
   */
  private observeFCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            const fcp = entry.startTime;
            this.recordMetric({
              name: 'FCP',
              value: fcp,
              rating: fcp < 1800 ? 'good' : fcp < 3000 ? 'needs-improvement' : 'poor'
            });
            observer.disconnect();
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      console.warn('FCP observation failed:', e);
    }
  }

  /**
   * LCP - Largest Contentful Paint
   */
  private observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        const lcp = lastEntry.startTime;

        this.recordMetric({
          name: 'LCP',
          value: lcp,
          rating: lcp < 2500 ? 'good' : lcp < 4000 ? 'needs-improvement' : 'poor'
        });
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('LCP observation failed:', e);
    }
  }

  /**
   * FID - First Input Delay
   */
  private observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = (entry as any).processingStart - entry.startTime;
          this.recordMetric({
            name: 'FID',
            value: fid,
            rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor'
          });
          observer.disconnect();
        }
      });
      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      console.warn('FID observation failed:', e);
    }
  }

  /**
   * CLS - Cumulative Layout Shift
   */
  private observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }

        this.recordMetric({
          name: 'CLS',
          value: clsValue,
          rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor'
        });
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.warn('CLS observation failed:', e);
    }
  }

  /**
   * Кастомные метрики (TTI, bundle size, etc)
   */
  private observeCustomMetrics() {
    // TTI - Time to Interactive (приблизительно)
    if (document.readyState === 'complete') {
      this.measureTTI();
    } else {
      window.addEventListener('load', () => this.measureTTI());
    }

    // Измеряем размер загруженных ресурсов
    this.measureResourceSize();
  }

  /**
   * TTI - приблизительная оценка
   */
  private measureTTI() {
    if (!performance.timing) return;

    const tti = performance.timing.domInteractive - performance.timing.navigationStart;
    
    this.recordMetric({
      name: 'TTI',
      value: tti,
      rating: tti < 3800 ? 'good' : tti < 7300 ? 'needs-improvement' : 'poor'
    });
  }

  /**
   * Размер загруженных ресурсов
   */
  private measureResourceSize() {
    if (!performance.getEntriesByType) return;

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const totalSize = resources.reduce((sum, entry) => {
      return sum + (entry.transferSize || 0);
    }, 0);

    const totalSizeKB = totalSize / 1024;

    this.recordMetric({
      name: 'TotalResourceSize',
      value: totalSizeKB,
      rating: totalSizeKB < 500 ? 'good' : totalSizeKB < 1000 ? 'needs-improvement' : 'poor'
    });
  }

  /**
   * Измеряет время выполнения функции
   */
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.recordMetric({
      name: `Custom: ${name}`,
      value: duration,
      rating: duration < 16 ? 'good' : duration < 50 ? 'needs-improvement' : 'poor'
    });

    return result;
  }

  /**
   * Измеряет время выполнения async функции
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.recordMetric({
      name: `Custom: ${name}`,
      value: duration,
      rating: duration < 100 ? 'good' : duration < 300 ? 'needs-improvement' : 'poor'
    });

    return result;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-initialize в production
if (import.meta.env.PROD) {
  performanceMonitor.initialize();
}

// React Hook для использования в компонентах
export function usePerformanceMonitor() {
  return performanceMonitor;
}

