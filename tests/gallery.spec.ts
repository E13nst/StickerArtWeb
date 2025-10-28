import { test, expect } from '@playwright/test';

test.describe('Sticker Gallery', () => {
  test.beforeEach(async ({ page }) => {
    // Логируем все запросы и ответы для диагностики
    page.on('request', request => {
      console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
      if (request.url().includes('/api/')) {
        console.log(`   Headers:`, request.headers());
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
        try {
          const data = await response.json();
          console.log(`   Data:`, JSON.stringify(data).substring(0, 200));
        } catch (e) {
          // Not JSON
        }
      }
    });
    
    page.on('console', msg => {
      console.log(`🖥️  CONSOLE: ${msg.text()}`);
    });
    
    // Переходим на главную страницу
    await page.goto('/miniapp/');
    
    // Ждем загрузки приложения
    await page.waitForLoadState('networkidle');
  });

  test('на главной странице загружается больше 10 карточек стикеров', async ({ page }) => {
    // Ждем загрузки галереи
    await page.waitForSelector('[data-testid="gallery-container"]', { timeout: 10000 });
    
    // Ждем появления карточек стикерсетов
    await page.waitForSelector('[data-testid="pack-card"]', { timeout: 10000 });
    
    // Получаем количество карточек на странице
    const packCards = await page.locator('[data-testid="pack-card"]').all();
    const cardsCount = packCards.length;
    
    console.log(`✅ Найдено карточек на странице: ${cardsCount}`);
    
    // Проверяем, что карточек больше 10
    expect(cardsCount).toBeGreaterThan(10);
  });
});
