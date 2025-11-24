import { test, expect } from '@playwright/test';
import {
  setupAuth,
  navigateToGallery,
  searchStickerSet,
  openStickerSet,
  checkThumbnails,
  waitForFirstMedia,
  clickThumbnailAndCheckMedia,
  waitForAnimation,
  waitForVideo
} from './helpers';

// ════════════════════════════════════════════════════════════════════════
// 🧪 TESTS
// ════════════════════════════════════════════════════════════════════════

test.describe('StickerSet Search and View', () => {
  
  test('Проверка загрузки анимаций (Lottie/WebP) на стикерсете R2-DOG2', async ({ page }) => {
    test.setTimeout(120000);
    const STICKER_SET_NAME = 'R2-DOG2';
    const STICKERS_TO_CHECK = 10;

    await setupAuth(page);
    await navigateToGallery(page);
    await searchStickerSet(page, STICKER_SET_NAME);
    await openStickerSet(page, STICKER_SET_NAME);
    await waitForFirstMedia(page);

    const stickersToCheck = await checkThumbnails(page, STICKERS_TO_CHECK);

    let loadedCount = 0;
    const failed: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < stickersToCheck; i++) {
      const result = await clickThumbnailAndCheckMedia(page, i, (p) => waitForAnimation(p, 5000));
      if (result.success) {
        loadedCount++;
      } else {
        failed.push({ index: i + 1, reason: result.reason || 'Неизвестная ошибка' });
      }
    }

    expect(loadedCount).toBe(stickersToCheck);
  });

  test('Проверка загрузки видео-стикеров на стикерсете notpixel', async ({ page }) => {
    test.setTimeout(120000);
    const STICKER_SET_NAME = 'notpixel';
    const STICKERS_TO_CHECK = 10;

    await setupAuth(page);
    await navigateToGallery(page);
    await searchStickerSet(page, STICKER_SET_NAME);
    await openStickerSet(page, STICKER_SET_NAME);
    await waitForFirstMedia(page);

    const stickersToCheck = await checkThumbnails(page, STICKERS_TO_CHECK);

    let loadedCount = 0;
    const failed: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < stickersToCheck; i++) {
      const result = await clickThumbnailAndCheckMedia(page, i, (p) => waitForVideo(p, 5000));
      if (result.success) {
        loadedCount++;
      } else {
        failed.push({ index: i + 1, reason: result.reason || 'Неизвестная ошибка' });
      }
    }

    expect(loadedCount).toBe(stickersToCheck);
  });
});
