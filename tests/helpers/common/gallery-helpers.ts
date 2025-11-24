import { Page, expect } from '@playwright/test';

/**
 * Переход на страницу галереи и ожидание загрузки
 */
export async function navigateToGallery(page: Page): Promise<void> {
  await page.goto('/miniapp/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="gallery-container"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="pack-card"]', { timeout: 10000 });
}

/**
 * Поиск стикерсета по названию
 */
export async function searchStickerSet(page: Page, stickerSetName: string): Promise<void> {
  // Открываем поиск
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const searchButton = buttons.find(btn => {
      const svg = btn.querySelector('svg');
      return svg && (
        btn.getAttribute('aria-label')?.toLowerCase().includes('search') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('поиск') ||
        svg.querySelector('path[d*="M15.5"]') !== null
      );
    });
    searchButton?.click();
  });

  await page.waitForTimeout(500);

  // Вводим текст поиска
  const searchInput = page.locator('[data-testid="search-input"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });

  await page.evaluate((searchText) => {
    const input = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    if (input) {
      input.value = searchText;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, searchText);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { 
        key: 'Enter', 
        code: 'Enter', 
        keyCode: 13, 
        bubbles: true 
      }));
    }
  }, stickerSetName);

  await page.waitForTimeout(1000);
  await page.waitForFunction(() => {
    const cards = document.querySelectorAll('[data-testid="pack-card"]');
    return cards.length > 0;
  }, { timeout: 10000 });
}

/**
 * Открытие стикерсета для просмотра
 */
export async function openStickerSet(page: Page, stickerSetName: string): Promise<void> {
  await page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll('[data-testid="pack-card"]'));
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const targetCard = cards.find(card => {
      const text = card.textContent || '';
      return regex.test(text);
    });
    targetCard && (targetCard as HTMLElement).click();
  }, stickerSetName);

  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    return document.body.classList.contains('modal-lock') ||
           document.documentElement.classList.contains('modal-lock');
  }, { timeout: 10000 });
}

/**
 * Проверка загрузки миниатюр
 */
export async function checkThumbnails(page: Page, count: number): Promise<number> {
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('[data-thumbnail-index]');
    return items.length > 0;
  }, { timeout: 20000 });

  await page.waitForTimeout(2000);

  const thumbnails = page.locator('[data-thumbnail-index]');
  const totalCount = await thumbnails.count();
  const stickersToCheck = Math.min(count, totalCount);

  let loadedCount = 0;
  for (let i = 0; i < stickersToCheck; i++) {
    const thumbnail = page.locator(`[data-thumbnail-index="${i}"]`);
    const hasMedia = await thumbnail.evaluate((el) => {
      const img = el.querySelector('img');
      const video = el.querySelector('video');
      const canvas = el.querySelector('canvas');
      const svg = el.querySelector('svg');
      return (img?.src && img.src !== '') ||
             (video?.src && video.src !== '') ||
             !!canvas || !!svg;
    });
    if (hasMedia) loadedCount++;
  }

  const minRequired = Math.floor(stickersToCheck * 0.8);
  expect(loadedCount).toBeGreaterThanOrEqual(minRequired);
  return stickersToCheck;
}

