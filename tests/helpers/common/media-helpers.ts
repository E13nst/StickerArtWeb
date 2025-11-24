import { Page, expect } from '@playwright/test';

export interface MediaStatus {
  hasLoading: boolean;
  loadedCount: number;
  imageCount: number;
  videoCount: number;
  fallbackCount: number;
  emojiCount: number;
}

/**
 * Проверка загрузки первой медиа (анимация/видео)
 */
export async function waitForFirstMedia(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const allMedia = document.querySelectorAll('img, video, canvas, svg');
    for (const el of Array.from(allMedia)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 150 && rect.height > 150 && rect.top >= 0 && rect.left >= 0) {
        if (el.tagName === 'IMG') {
          const img = el as HTMLImageElement;
          if (img.src && img.complete && img.naturalWidth > 0) return true;
        } else if (el.tagName === 'VIDEO') {
          const video = el as HTMLVideoElement;
          if (video.src && video.readyState >= 2) return true;
        } else if (el.tagName === 'CANVAS') {
          const canvas = el as HTMLCanvasElement;
          if (canvas.width > 0 && canvas.height > 0) return true;
        } else if (el.tagName === 'svg') {
          const svg = el as SVGElement;
          if (svg.children.length > 0) return true;
        }
      }
    }
    return false;
  }, { timeout: 15000 });
}

/**
 * Проверка наличия заглушек в главной области
 */
export async function hasFallbackInMainArea(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const mainAreaTop = 0;
    const mainAreaBottom = viewportHeight * 0.7;

    // Проверяем fallback изображения
    const fallbacks = document.querySelectorAll('[data-animation-fallback="true"]');
    for (const fallback of Array.from(fallbacks)) {
      const rect = fallback.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100 && 
          rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
          rect.width > 0 && rect.height > 0) {
        return true;
      }
    }

    // Проверяем эмодзи-заглушки
    const emojiFallbacks = document.querySelectorAll('[data-emoji-fallback="true"]');
    for (const emojiDiv of Array.from(emojiFallbacks)) {
      const rect = emojiDiv.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50 && 
          rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
          rect.width > 0 && rect.height > 0) {
        return true;
      }
    }

    // Проверяем по содержимому
    const centerElement = document.elementFromPoint(viewportCenterX, viewportCenterY);
    if (centerElement) {
      let checkEl: Element | null = centerElement;
      for (let i = 0; i < 5 && checkEl; i++) {
        if (checkEl.tagName === 'DIV') {
          const div = checkEl as HTMLDivElement;
          const rect = div.getBoundingClientRect();
          const style = window.getComputedStyle(div);
          const fontSize = parseFloat(style.fontSize);
          if (rect.width > 50 && rect.height > 50 && 
              fontSize >= 35 &&
              rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
              (div.textContent?.includes('🎨') || div.textContent?.includes('🎭') || 
               div.textContent?.match(/[\u{1F300}-\u{1F9FF}]/u))) {
            return true;
          }
        }
        checkEl = checkEl.parentElement;
      }
    }

    return false;
  });
}

/**
 * Получение статуса медиа в главной области
 */
export async function getMediaStatus(page: Page): Promise<MediaStatus> {
  return page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    const mainAreaTop = 0;
    const mainAreaBottom = viewportHeight * 0.7;

    // Проверяем CircularProgress
    const circularProgresses = document.querySelectorAll('.MuiCircularProgress-root, [class*="CircularProgress"]');
    let hasLoading = false;
    for (const progress of Array.from(circularProgresses)) {
      const rect = progress.getBoundingClientRect();
      if (rect.width > 30 && rect.height > 30 && 
          rect.top >= mainAreaTop && rect.top < mainAreaBottom) {
        hasLoading = true;
        break;
      }
    }

    // Lottie контейнеры
    const lottieContainers = document.querySelectorAll('[data-lottie-container="true"]');
    let loadedCount = 0;
    for (const container of Array.from(lottieContainers)) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200) {
        const canvas = container.querySelector('canvas');
        const svg = container.querySelector('svg');
        if ((svg && svg.children.length > 0) || (canvas && canvas.width > 0)) {
          loadedCount++;
        }
      }
    }

    // Изображения (WebP анимации)
    const images = document.querySelectorAll('img');
    let imageCount = 0;
    for (const img of Array.from(images)) {
      const rect = img.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200 && 
          img.complete && img.naturalWidth > 0 && img.naturalHeight > 0 &&
          !img.hasAttribute('data-animation-fallback')) {
        imageCount++;
      }
    }

    // Видео
    const videos = document.querySelectorAll('video');
    let videoCount = 0;
    for (const video of Array.from(videos)) {
      const rect = video.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200 && 
          video.readyState >= 2) {
        videoCount++;
      }
    }

    // Fallback
    const fallbacks = document.querySelectorAll('[data-animation-fallback="true"]');
    let fallbackCount = 0;
    for (const fallback of Array.from(fallbacks)) {
      const rect = fallback.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100 && 
          rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
          rect.width > 0 && rect.height > 0) {
        fallbackCount++;
      }
    }

    // Эмодзи-заглушки
    const emojiFallbacks = document.querySelectorAll('[data-emoji-fallback="true"]');
    let emojiCount = 0;
    for (const emojiDiv of Array.from(emojiFallbacks)) {
      const rect = emojiDiv.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50 && 
          rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
          rect.width > 0 && rect.height > 0) {
        emojiCount++;
      }
    }

    const centerElement = document.elementFromPoint(viewportCenterX, viewportCenterY);
    if (centerElement) {
      let checkEl: Element | null = centerElement;
      for (let i = 0; i < 5 && checkEl; i++) {
        if (checkEl.tagName === 'DIV') {
          const div = checkEl as HTMLDivElement;
          const rect = div.getBoundingClientRect();
          const style = window.getComputedStyle(div);
          const fontSize = parseFloat(style.fontSize);
          if (rect.width > 50 && rect.height > 50 && 
              fontSize >= 35 &&
              rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
              (div.textContent?.includes('🎨') || div.textContent?.includes('🎭') || 
               div.textContent?.match(/[\u{1F300}-\u{1F9FF}]/u))) {
            emojiCount++;
            break;
          }
        }
        checkEl = checkEl.parentElement;
      }
    }

    return { hasLoading, loadedCount, imageCount, videoCount, fallbackCount, emojiCount };
  });
}

/**
 * Ожидание загрузки анимации (Lottie или WebP)
 */
export async function waitForAnimation(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const viewportCenterX = viewportWidth / 2;
      const viewportCenterY = viewportHeight / 2;
      const mainAreaTop = 0;
      const mainAreaBottom = viewportHeight * 0.7;

      // Проверяем заглушки
      const fallbacks = document.querySelectorAll('[data-animation-fallback="true"]');
      for (const fallback of Array.from(fallbacks)) {
        const rect = fallback.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
            rect.width > 0 && rect.height > 0) {
          return false;
        }
      }

      const emojiFallbacks = document.querySelectorAll('[data-emoji-fallback="true"]');
      for (const emojiDiv of Array.from(emojiFallbacks)) {
        const rect = emojiDiv.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
            rect.width > 0 && rect.height > 0) {
          return false;
        }
      }

      // Проверяем CircularProgress
      const circularProgresses = document.querySelectorAll('.MuiCircularProgress-root, [class*="CircularProgress"]');
      for (const progress of Array.from(circularProgresses)) {
        const rect = progress.getBoundingClientRect();
        if (rect.width > 30 && rect.height > 30 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom) {
          return false;
        }
      }

      // Ищем Lottie анимацию
      const lottieContainers = document.querySelectorAll('[data-lottie-container="true"]');
      for (const container of Array.from(lottieContainers)) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 200 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
            rect.left >= 0 && rect.right <= viewportWidth) {
          const canvas = container.querySelector('canvas');
          const svg = container.querySelector('svg');
          const hasMedia = (svg && svg.children.length > 0) || (canvas && canvas.width > 0);
          if (hasMedia) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distanceFromCenter = Math.sqrt(
              Math.pow(centerX - viewportCenterX, 2) + 
              Math.pow(centerY - viewportCenterY, 2)
            );
            if (distanceFromCenter < 500) return true;
          }
        }
      }

      // Ищем WebP анимации (изображения)
      const images = document.querySelectorAll('img');
      for (const img of Array.from(images)) {
        const rect = img.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 200 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
            rect.left >= 0 && rect.right <= viewportWidth &&
            img.complete && img.naturalWidth > 0 && img.naturalHeight > 0 &&
            !img.hasAttribute('data-animation-fallback')) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - viewportCenterX, 2) + 
            Math.pow(centerY - viewportCenterY, 2)
          );
          if (distanceFromCenter < 500) return true;
        }
      }

      return false;
    }, { timeout, polling: 500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ожидание загрузки видео
 */
export async function waitForVideo(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const viewportCenterX = viewportWidth / 2;
      const viewportCenterY = viewportHeight / 2;
      const mainAreaTop = 0;
      const mainAreaBottom = viewportHeight * 0.7;

      // Проверяем CircularProgress
      const circularProgresses = document.querySelectorAll('.MuiCircularProgress-root, [class*="CircularProgress"]');
      for (const progress of Array.from(circularProgresses)) {
        const rect = progress.getBoundingClientRect();
        if (rect.width > 30 && rect.height > 30 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom) {
          return false;
        }
      }

      // Ищем видео
      const videos = document.querySelectorAll('video');
      for (const video of Array.from(videos)) {
        const rect = video.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 200 && 
            rect.top >= mainAreaTop && rect.top < mainAreaBottom &&
            rect.left >= 0 && rect.right <= viewportWidth &&
            video.readyState >= 2) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - viewportCenterX, 2) + 
            Math.pow(centerY - viewportCenterY, 2)
          );
          if (distanceFromCenter < 500) return true;
        }
      }

      return false;
    }, { timeout, polling: 500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Клик по миниатюре и проверка загрузки медиа
 */
export async function clickThumbnailAndCheckMedia(
  page: Page,
  index: number,
  checkFunction: (page: Page) => Promise<boolean>
): Promise<{ success: boolean; reason?: string }> {
  const thumbnail = page.locator(`[data-thumbnail-index="${index}"]`);

  try {
    await thumbnail.scrollIntoViewIfNeeded({ timeout: 3000 });
    await page.waitForTimeout(200);
  } catch {
    return { success: false, reason: 'Миниатюра недоступна' };
  }

  try {
    await thumbnail.click({ timeout: 3000 });
  } catch {
    return { success: false, reason: 'Клик не удался' };
  }

  // Проверяем заглушки
  if (await hasFallbackInMainArea(page)) {
    return { success: false, reason: 'Обнаружена заглушка' };
  }

  // Ждем загрузки медиа
  const loaded = await checkFunction(page);
  if (loaded) {
    return { success: true };
  }

  // Диагностика при неудаче
  const status = await getMediaStatus(page);
  let reason = 'Таймаут';
  if (status.emojiCount > 0) {
    reason = 'Показана эмодзи-заглушка';
  } else if (status.fallbackCount > 0) {
    reason = 'Показан fallback';
  } else if (status.hasLoading) {
    reason = 'CircularProgress не исчез';
  } else if (status.loadedCount === 0 && status.imageCount === 0 && status.videoCount === 0) {
    reason = 'Нет медиа';
  } else {
    reason = `Найдено Lottie: ${status.loadedCount}, Img: ${status.imageCount}, Video: ${status.videoCount}, но не подошли`;
  }

  return { success: false, reason };
}

