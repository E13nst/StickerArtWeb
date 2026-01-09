import { Page } from '@playwright/test';

// @ts-ignore - process доступен в Node.js окружении Playwright
declare const process: any;

/**
 * Настройка авторизации через X-Telegram-Init-Data
 * Устанавливает заголовки для API запросов и initData в localStorage для приложения
 * Приложение само создаст mock Telegram окружение через useTelegram хук
 */
export async function setupAuth(page: Page): Promise<void> {
  const initData = process.env.TELEGRAM_INIT_DATA || '';
  if (!initData) {
    throw new Error('TELEGRAM_INIT_DATA не задан');
  }

  // Устанавливаем initData в localStorage ДО загрузки страницы
  // useTelegram хук прочитает его через getRealInitDataForTesting() и создаст mock
  await page.addInitScript((initData) => {
    localStorage.setItem('dev_telegram_init_data', initData);
    console.log('✅ InitData установлен в localStorage для тестирования');
  }, initData);

  // Перехватываем все запросы и добавляем заголовок авторизации
  await page.route('**/*', async (route) => {
    const headers = {
      ...route.request().headers(),
      'X-Telegram-Init-Data': initData
    };
    await route.continue({ headers });
  });

  console.log('✅ Авторизация настроена для теста');
}

