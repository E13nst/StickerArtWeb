import { Page } from '@playwright/test';

/**
 * Статистика медиа карточек
 */
export interface MediaStats {
  imagesWithSrc: number;
  videosWithSrc: number;
  animationsWithCanvas: number;
  emptyMedia: number;
  totalCards: number;
  loadedMedia: number;
  emptyCardIndices?: number[];
}

/**
 * Результат скролла галереи
 */
export interface ScrollResult {
  success: boolean;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
  fallback?: boolean;
  scrollY?: number;
}

/**
 * Статистика кешей
 */
export interface CacheStats {
  cacheStats: {
    images: number;
    animations: number;
    videos: number;
  };
  cardDetails: Array<{
    index: number;
    hasVisibleMedia: boolean;
    mediaType: string;
    hasAnimatedSticker: boolean;
    hasLottieCanvas: boolean;
    imgSrc: string | null;
    videoSrc: string | null;
  }>;
}

/**
 * Получение статистики медиа карточек
 */
export async function getMediaStats(page: Page, includeEmptyIndices: boolean = false): Promise<MediaStats> {
  return page.evaluate((includeIndices: boolean) => {
    const cards = document.querySelectorAll('[data-testid="pack-card"]');
    let imagesWithSrc = 0;
    let videosWithSrc = 0;
    let animationsWithCanvas = 0;
    let emptyMedia = 0;
    const emptyCardIndices: number[] = [];

    cards.forEach((card, index) => {
      const img = card.querySelector('img.pack-card-image');
      const video = card.querySelector('video.pack-card-video');
      const animatedSticker = card.querySelector('.pack-card-animated-sticker');
      const lottieCanvas = animatedSticker ? animatedSticker.querySelector('svg, canvas') : null;

      const hasImage = !!(img && img.getAttribute('src') && img.getAttribute('src') !== '');
      const hasVideo = !!(video && video.getAttribute('src') && video.getAttribute('src') !== '');
      const hasAnimationCanvas = !!lottieCanvas;

      if (hasImage) {
        imagesWithSrc++;
      } else if (hasVideo) {
        videosWithSrc++;
      } else if (hasAnimationCanvas) {
        animationsWithCanvas++;
      } else {
        emptyMedia++;
        if (includeIndices) {
          emptyCardIndices.push(index);
        }
      }
    });

    const loadedMedia = imagesWithSrc + videosWithSrc + animationsWithCanvas;

    return {
      imagesWithSrc,
      videosWithSrc,
      animationsWithCanvas,
      emptyMedia,
      totalCards: cards.length,
      loadedMedia,
      ...(includeIndices ? { emptyCardIndices } : {})
    };
  }, includeEmptyIndices);
}

/**
 * Скролл галереи до конца
 */
export async function scrollGalleryToBottom(page: Page): Promise<ScrollResult> {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="gallery-container"]');
    if (container) {
      // Скроллим контейнер до конца
      container.scrollTop = container.scrollHeight;
      return {
        success: true,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight
      };
    }
    // Fallback: скроллим window
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    return {
      success: false,
      fallback: true,
      scrollY: window.scrollY,
      scrollHeight: document.body.scrollHeight
    };
  });
}

/**
 * Ожидание загрузки медиа с проверкой
 */
export async function waitForMediaLoad(
  page: Page,
  targetCount: number,
  maxWaitTime: number,
  logProgress: boolean = true
): Promise<MediaStats> {
  const startTime = Date.now();
  let mediaAttempts = 0;
  let finalStats: MediaStats;

  while (Date.now() - startTime < maxWaitTime) {
    finalStats = await getMediaStats(page, true);

    if (logProgress && mediaAttempts % 10 === 0) {
      console.log(`  🔄 Попытка ${mediaAttempts + 1}: ${finalStats.loadedMedia}/${finalStats.totalCards} медиа загружено (цель: ${targetCount})`);
      if (finalStats.emptyCardIndices && finalStats.emptyCardIndices.length > 0 && finalStats.emptyCardIndices.length <= 5) {
        console.log(`     - Карточки без медиа: ${finalStats.emptyCardIndices.join(', ')}`);
      }
    }

    if (finalStats.loadedMedia >= targetCount) {
      const waitedTime = Date.now() - startTime;
      console.log(`✅ ${targetCount} медиа загружено за ${formatTime(waitedTime)}`);
      break;
    }

    await page.waitForTimeout(100); // Проверяем каждые 100ms
    mediaAttempts++;
  }

  return finalStats!;
}

/**
 * Получение статистики кешей
 */
export async function getCacheStats(page: Page): Promise<CacheStats | { error: string }> {
  return page.evaluate(() => {
    // Получаем доступ к кешам через window
    const imageLoader = (window as any).imageLoader;
    if (!imageLoader) return { error: 'imageLoader not found' };

    const { animationCache, imageCache, videoBlobCache } = imageLoader;

    // Статистика кешей
    const cacheStats = {
      images: imageCache ? Array.from(imageCache.keys ? imageCache.keys() : []).length : 0,
      animations: animationCache ? Array.from(animationCache.keys ? animationCache.keys() : []).length : 0,
      videos: videoBlobCache ? Array.from(videoBlobCache.keys ? videoBlobCache.keys() : []).length : 0
    };

    // Проверяем карточки
    const cards = document.querySelectorAll('[data-testid="pack-card"]');
    const cardDetails: Array<{
      index: number;
      hasVisibleMedia: boolean;
      mediaType: string;
      hasAnimatedSticker: boolean;
      hasLottieCanvas: boolean;
      imgSrc: string | null;
      videoSrc: string | null;
    }> = [];

    cards.forEach((card, index) => {
      const img = card.querySelector('img.pack-card-image');
      const video = card.querySelector('video.pack-card-video');
      const animatedSticker = card.querySelector('.pack-card-animated-sticker');
      const lottieCanvas = animatedSticker ? animatedSticker.querySelector('svg, canvas') : null;

      const hasVisibleMedia = !!(
        (img && img.getAttribute('src') && img.getAttribute('src') !== '') ||
        (video && video.getAttribute('src') && video.getAttribute('src') !== '') ||
        lottieCanvas
      );

      const mediaType = img ? 'image' : video ? 'video' : animatedSticker ? 'animation' : 'none';

      cardDetails.push({
        index,
        hasVisibleMedia,
        mediaType,
        hasAnimatedSticker: !!animatedSticker,
        hasLottieCanvas: !!lottieCanvas,
        imgSrc: img ? img.getAttribute('src') : null,
        videoSrc: video ? video.getAttribute('src') : null
      });
    });

    return { cacheStats, cardDetails };
  });
}

/**
 * Логирование статистики медиа
 */
export function logMediaStats(stats: MediaStats, label: string): void {
  console.log(`  📊 Медиа статистика ${label}:`);
  console.log(`     - Изображений с src: ${stats.imagesWithSrc}`);
  console.log(`     - Видео с src: ${stats.videosWithSrc}`);
  console.log(`     - Анимаций с canvas: ${stats.animationsWithCanvas}`);
  console.log(`     - Карточек без медиа: ${stats.emptyMedia}`);
  console.log(`     - Всего карточек: ${stats.totalCards}`);
  const percentage = stats.totalCards > 0 
    ? ((stats.loadedMedia / stats.totalCards) * 100).toFixed(1)
    : '0.0';
  console.log(`     - Загружено медиа: ${stats.loadedMedia}/${stats.totalCards} (${percentage}%)`);
}

/**
 * Форматирование времени (вспомогательная функция)
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

