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
  // Сначала проверяем, какой режим скролла используется
  const scrollMode = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="gallery-container"]');
    if (!container) return 'page';
    
    const containerStyle = window.getComputedStyle(container);
    const hasScroll = containerStyle.overflowY === 'auto' || containerStyle.overflowY === 'scroll';
    const isPageScroll = container.classList.contains('simpleGallery--pageScroll');
    
    return hasScroll && !isPageScroll ? 'inner' : 'page';
  });
  
  if (scrollMode === 'inner') {
    // Inner scroll режим - скроллим контейнер
    return page.evaluate(() => {
      const container = document.querySelector('[data-testid="gallery-container"]') as HTMLElement;
      if (container && container.scrollHeight > container.clientHeight) {
        container.scrollTop = container.scrollHeight;
        return {
          success: true,
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight
        };
      }
      return {
        success: false,
        fallback: true
      };
    });
  } else {
    // Page scroll режим - скроллим контейнер stixly-main-scroll из MainLayout
    // Ждем, пока контент отрендерится
    await page.waitForTimeout(1000);
    
    // Ищем контейнер stixly-main-scroll
    const scrollContainer = page.locator('.stixly-main-scroll').first();
    const containerExists = await scrollContainer.count() > 0;
    
    if (containerExists) {
      // Скроллим контейнер stixly-main-scroll используя Playwright API
      // Получаем информацию о контейнере
      const containerInfo = await scrollContainer.evaluate((el) => {
        return {
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          currentScroll: el.scrollTop
        };
      });
      
      // Вычисляем целевую позицию скролла
      const targetScroll = Math.max(0, containerInfo.scrollHeight - containerInfo.clientHeight + 800);
      
      // Скроллим контейнер используя Playwright API
      await scrollContainer.evaluate((el, target) => {
        el.scrollTop = target;
      }, targetScroll);
      
      // Ждем обновления скролла
      await page.waitForTimeout(500);
      
      // Получаем финальную информацию
      const finalInfo = await scrollContainer.evaluate((el) => {
        return {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        };
      });
      
      return {
        success: true,
        fallback: false,
        scrollTop: finalInfo.scrollTop,
        scrollHeight: finalInfo.scrollHeight,
        clientHeight: finalInfo.clientHeight
      };
    } else {
      // Fallback: скроллим window, если контейнер не найден
      const result = await page.evaluate(() => {
        const scrollHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        );
        
        const clientHeight = window.innerHeight;
        const targetScroll = Math.max(0, scrollHeight - clientHeight + 800);
        
        window.scrollTo({ 
          top: targetScroll, 
          behavior: 'instant' 
        });
        
        return {
          success: true,
          fallback: true,
          scrollY: window.scrollY || document.documentElement.scrollTop,
          scrollTop: window.scrollY || document.documentElement.scrollTop,
          scrollHeight: scrollHeight,
          clientHeight: clientHeight
        };
      });
      
      await page.waitForTimeout(500);
      return result;
    }
  }
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

/**
 * Получение индексов видимых рядов в DOM
 */
export async function getVisibleRowIndices(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('[data-index]');
    const indices: number[] = [];
    
    rows.forEach((row) => {
      const indexAttr = row.getAttribute('data-index');
      if (indexAttr !== null) {
        const index = parseInt(indexAttr, 10);
        if (!isNaN(index)) {
          indices.push(index);
        }
      }
    });
    
    return indices.sort((a, b) => a - b);
  });
}

/**
 * Ожидание загрузки медиа для конкретного ряда
 */
export async function waitForRowMediaLoad(
  page: Page,
  rowIndex: number,
  timeout: number = 5000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const hasMedia = await page.evaluate((index: number) => {
      // Находим ряд по data-index
      const row = document.querySelector(`[data-index="${index}"]`);
      if (!row) return false;
      
      // Находим все карточки в этом ряду
      const cards = row.querySelectorAll('[data-testid="pack-card"]');
      if (cards.length === 0) return false;
      
      // Проверяем медиа для каждой карточки
      let cardsWithMedia = 0;
      cards.forEach((card) => {
        const img = card.querySelector('img.pack-card-image');
        const video = card.querySelector('video.pack-card-video');
        const animatedSticker = card.querySelector('.pack-card-animated-sticker');
        const lottieCanvas = animatedSticker ? animatedSticker.querySelector('svg, canvas') : null;
        
        const hasImage = !!(img && img.getAttribute('src') && img.getAttribute('src') !== '');
        const hasVideo = !!(video && video.getAttribute('src') && video.getAttribute('src') !== '');
        const hasAnimationCanvas = !!lottieCanvas;
        
        if (hasImage || hasVideo || hasAnimationCanvas) {
          cardsWithMedia++;
        }
      });
      
      // Считаем ряд загруженным если 80%+ карточек имеют медиа
      const minCardsRequired = Math.ceil(cards.length * 0.8);
      return cardsWithMedia >= minCardsRequired;
    }, rowIndex);
    
    if (hasMedia) {
      return true;
    }
    
    await page.waitForTimeout(100); // Проверяем каждые 100ms
  }
  
  return false;
}

/**
 * Скролл к следующему ряду
 */
export async function scrollToNextRow(
  page: Page,
  currentRowIndex: number
): Promise<number> {
  // Определяем контейнер скролла
  const scrollInfo = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="gallery-container"]');
    if (!container) return null;
    
    const containerStyle = window.getComputedStyle(container);
    const hasScroll = containerStyle.overflowY === 'auto' || containerStyle.overflowY === 'scroll';
    const isPageScroll = container.classList.contains('simpleGallery--pageScroll');
    
    return {
      mode: hasScroll && !isPageScroll ? 'inner' : 'page',
      container: container as HTMLElement
    };
  });
  
  if (!scrollInfo) {
    // Fallback на обычный скролл страницы
    await page.evaluate(() => {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    });
    await page.waitForTimeout(300);
    return currentRowIndex + 1;
  }
  
  // Вычисляем высоту одного ряда и скроллим
  const scrollResult = await page.evaluate(
    ({ mode, currentIndex }: { mode: string; currentIndex: number }) => {
      let scrollContainer: HTMLElement | null = null;
      
      if (mode === 'inner') {
        scrollContainer = document.querySelector('[data-testid="gallery-container"]') as HTMLElement;
      } else {
        // Ищем stixly-main-scroll или используем window
        scrollContainer = document.querySelector('.stixly-main-scroll') as HTMLElement;
        if (!scrollContainer) {
          // Используем window для скролла
          const currentScroll = window.scrollY || document.documentElement.scrollTop;
          const viewportHeight = window.innerHeight;
          window.scrollTo({
            top: currentScroll + viewportHeight * 0.8,
            behavior: 'smooth'
          });
          return { success: true, newIndex: currentIndex + 1 };
        }
      }
      
      if (!scrollContainer) return { success: false, newIndex: currentIndex };
      
      // Находим текущие видимые ряды для вычисления высоты
      const rows = Array.from(document.querySelectorAll('[data-index]'));
      if (rows.length === 0) return { success: false, newIndex: currentIndex };
      
      // Вычисляем среднюю высоту ряда
      let totalHeight = 0;
      let rowCount = 0;
      rows.forEach((row) => {
        const rect = row.getBoundingClientRect();
        if (rect.height > 0) {
          totalHeight += rect.height;
          rowCount++;
        }
      });
      
      const avgRowHeight = rowCount > 0 ? totalHeight / rowCount : 400; // Fallback: 400px
      
      // Скроллим на высоту одного ряда
      const currentScroll = scrollContainer.scrollTop || window.scrollY || 0;
      const targetScroll = currentScroll + avgRowHeight;
      
      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
      
      return { success: true, newIndex: currentIndex + 1, scrollTop: targetScroll };
    },
    { mode: scrollInfo.mode, currentIndex: currentRowIndex }
  );
  
  // Ждем обновления виртуализации и появления нового ряда
  await page.waitForTimeout(500);
  
  return scrollResult.newIndex;
}

