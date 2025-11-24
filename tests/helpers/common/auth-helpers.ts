import { Page } from '@playwright/test';

// @ts-ignore - process доступен в Node.js окружении Playwright
declare const process: any;

/**
 * Настройка авторизации через X-Telegram-Init-Data
 */
export async function setupAuth(page: Page): Promise<void> {
  const initData = process.env.TELEGRAM_INIT_DATA || '';
  if (!initData) {
    throw new Error('TELEGRAM_INIT_DATA не задан');
  }

  await page.route('**/*', async (route) => {
    const headers = {
      ...route.request().headers(),
      'X-Telegram-Init-Data': initData
    };
    await route.continue({ headers });
  });
}

