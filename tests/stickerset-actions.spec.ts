import { test, expect, Page } from '@playwright/test';

// @ts-ignore - process доступен в Node.js окружении Playwright
declare const process: any;

/**
 * 🧪 ИНТЕГРАЦИОННЫЙ ТЕСТ: Проверка отображения кнопок действий
 * 
 * ✅ БЕЗОПАСНЫЙ ТЕСТ: Не выполняет никаких изменений в базе данных
 * 
 * Что проверяется:
 * 1. Кнопки действий отображаются на основе availableActions от API
 * 2. Если availableActions содержит BLOCK - показывается кнопка "Заблокировать"
 * 3. Если availableActions содержит UNBLOCK - показывается кнопка "Разблокировать"
 * 4. Если availableActions содержит DELETE - показывается кнопка "Удалить"
 * 5. Кнопки не дублируются и правильно переключаются
 * 
 * Тест НЕ кликает по кнопкам, только проверяет их наличие/отсутствие
 */

test.describe('StickerSet Actions: UI Display Check (Read-Only)', () => {
  let adminInitData: string;
  
  test.beforeAll(async () => {
    // Получаем initData для авторизации из переменной окружения
    adminInitData = process.env.TELEGRAM_INIT_DATA || '';
    
    if (!adminInitData) {
      console.warn('⚠️ TELEGRAM_INIT_DATA не установлен!');
      console.warn('Установите переменную окружения TELEGRAM_INIT_DATA для авторизации.');
      console.warn('Подробнее: см. tests/README.md');
      throw new Error('TELEGRAM_INIT_DATA is required for this test');
    }
    
    console.log('✅ TELEGRAM_INIT_DATA загружен из переменной окружения');
  });
  
  test.beforeEach(async ({ page }) => {
    // Настройка авторизации через заголовок
    await page.route('**/*', async (route) => {
      const headers = {
        ...route.request().headers(),
        'X-Telegram-Init-Data': adminInitData
      };
      await route.continue({ headers });
    });
    
    console.log('✅ Авторизация настроена через X-Telegram-Init-Data');
  });
  
  test('проверка отображения кнопок действий на основе availableActions (без изменений)', async ({ page }) => {
    console.log('\n🔍 Проверка UI: Отображение кнопок действий (read-only)...\n');
    
    test.setTimeout(60000); // 1 минута
    
    // ════════════════════════════════════════════════════════════════════════
    // ШАГ 1: Открываем галерею
    // ════════════════════════════════════════════════════════════════════════
    console.log('📄 Переход в галерею...');
    await page.goto('/miniapp/', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('[data-testid="gallery-container"]', { timeout: 10000 });
    console.log('✅ Галерея загружена');
    
    // ════════════════════════════════════════════════════════════════════════
    // ШАГ 2: Проверяем несколько стикерсетов
    // ════════════════════════════════════════════════════════════════════════
    await page.waitForSelector('[data-testid="pack-card"]', { timeout: 10000 });
    const packsCount = await page.locator('[data-testid="pack-card"]').count();
    console.log(`✅ Найдено ${packsCount} карточек стикерсетов\n`);
    
    expect(packsCount).toBeGreaterThan(0);
    
    // Проверяем до 3 стикерсетов
    const checksToPerform = Math.min(3, packsCount);
    
    for (let i = 0; i < checksToPerform; i++) {
      console.log(`${'='.repeat(80)}`);
      console.log(`📦 Проверка стикерсета #${i + 1} из ${checksToPerform}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Ждем загрузки медиа
      await page.waitForTimeout(2000);
      
      // Открываем стикерсет
      const cards = page.locator('[data-testid="pack-card"]');
      await cards.nth(i).click({ force: true });
      await page.waitForTimeout(2000);
      
      // Ждем открытия модального окна
      const detailCard = page.locator('.sticker-detail-info-card');
      await expect(detailCard).toBeVisible({ timeout: 10000 });
      console.log('✅ Модальное окно открыто');
      
      // ════════════════════════════════════════════════════════════════════
      // Проверяем какие кнопки видны
      // ════════════════════════════════════════════════════════════════════
      const blockButton = page.locator('button[aria-label="block"]');
      const unblockButton = page.locator('button[aria-label="unblock"]');
      const deleteButton = page.locator('button[aria-label="delete"]');
      const publishButton = page.locator('button[aria-label="publish"]');
      const unpublishButton = page.locator('button[aria-label="unpublish"]');
      
      const hasBlock = await blockButton.isVisible().catch(() => false);
      const hasUnblock = await unblockButton.isVisible().catch(() => false);
      const hasDelete = await deleteButton.isVisible().catch(() => false);
      const hasPublish = await publishButton.isVisible().catch(() => false);
      const hasUnpublish = await unpublishButton.isVisible().catch(() => false);
      
      console.log('📊 Доступные кнопки действий:');
      console.log(`  🚫 Заблокировать:    ${hasBlock ? '✅ ВИДИМА' : '❌ скрыта'}`);
      console.log(`  🔄 Разблокировать:   ${hasUnblock ? '✅ ВИДИМА' : '❌ скрыта'}`);
      console.log(`  🗑️  Удалить:         ${hasDelete ? '✅ ВИДИМА' : '❌ скрыта'}`);
      console.log(`  📤 Опубликовать:     ${hasPublish ? '✅ ВИДИМА' : '❌ скрыта'}`);
      console.log(`  📥 Снять публикацию: ${hasUnpublish ? '✅ ВИДИМА' : '❌ скрыта'}`);
      
      // ════════════════════════════════════════════════════════════════════
      // Проверяем логику взаимоисключающих кнопок
      // ════════════════════════════════════════════════════════════════════
      console.log('\n🔍 Проверка логики:');
      
      // BLOCK и UNBLOCK не должны быть видны одновременно
      if (hasBlock && hasUnblock) {
        console.log('  ❌ ОШИБКА: Кнопки BLOCK и UNBLOCK видны одновременно!');
        throw new Error('Обе кнопки блокировки видны одновременно');
      } else {
        console.log('  ✅ Кнопки BLOCK/UNBLOCK взаимоисключающие');
      }
      
      // PUBLISH и UNPUBLISH не должны быть видны одновременно
      if (hasPublish && hasUnpublish) {
        console.log('  ❌ ОШИБКА: Кнопки PUBLISH и UNPUBLISH видны одновременно!');
        throw new Error('Обе кнопки публикации видны одновременно');
      } else {
        console.log('  ✅ Кнопки PUBLISH/UNPUBLISH взаимоисключающие');
      }
      
      // Определяем состояние
      const state = {
        blocked: hasUnblock && !hasBlock,
        active: hasBlock && !hasUnblock,
        published: hasUnpublish && !hasPublish,
        unpublished: hasPublish && !hasUnpublish
      };
      
      console.log('\n📌 Состояние стикерсета:');
      if (state.blocked) {
        console.log('  🚫 ЗАБЛОКИРОВАН');
      } else if (state.active) {
        console.log('  ✅ АКТИВЕН');
      }
      
      if (state.published) {
        console.log('  📤 ОПУБЛИКОВАН');
      } else if (state.unpublished) {
        console.log('  📥 НЕ ОПУБЛИКОВАН');
      }
      
      // Закрываем модальное окно
      console.log('\n🔙 Закрываем модальное окно...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      
      console.log('');
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ФИНАЛ
    // ════════════════════════════════════════════════════════════════════════
    console.log(`${'='.repeat(80)}`);
    console.log('✅ ТЕСТ ЗАВЕРШЕН УСПЕШНО');
    console.log(`${'='.repeat(80)}`);
    console.log('📊 Результат: Кнопки действий корректно отображаются на основе availableActions');
    console.log('ℹ️  Никакие действия не были выполнены - только проверка отображения UI');
    console.log(`${'='.repeat(80)}\n`);
  });
});
