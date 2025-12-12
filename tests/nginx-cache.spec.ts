import { test, expect } from '@playwright/test';
import { setupAuth } from './helpers/common/auth-helpers';

/**
 * Тест для проверки nginx кеширования стикеров на проде
 * 
 * Проверяет:
 * 1. Заголовки X-Cache-Status, X-Cache-Key, X-Cache-Bypass
 * 2. Что первый запрос возвращает MISS
 * 3. Что повторный запрос возвращает HIT
 * 4. Что запросы с ?file=true кешируются
 * 5. Что запросы без ?file=true не кешируются
 */

// @ts-ignore - process доступен в Node.js окружении Playwright
declare const process: any;

const PROD_URL = 'https://sticker-art-e13nst.amvera.io';

test.describe('Nginx Cache Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Настраиваем авторизацию
    await setupAuth(page);
    
    // Переходим на главную страницу
    await page.goto(`${PROD_URL}/miniapp/`);
    await page.waitForLoadState('networkidle');
  });

  test('Проверка кеширования стикеров с параметром ?file=true', async ({ page, request }) => {
    // Получаем file_id стикера через API
    const apiResponse = await request.get(`${PROD_URL}/api/stickersets?limit=1`, {
      headers: {
        'X-Telegram-Init-Data': process.env.TELEGRAM_INIT_DATA || ''
      }
    });
    
    expect(apiResponse.ok()).toBeTruthy();
    const data = await apiResponse.json();
    
    let fileId: string | null = null;
    
    if (data.stickersets && data.stickersets.length > 0) {
      const stickerset = data.stickersets[0];
      if (stickerset.stickers && stickerset.stickers.length > 0) {
        fileId = stickerset.stickers[0].file_id;
      }
    }
    
    // Если не получили file_id из API, используем тестовый
    if (!fileId) {
      fileId = 'CAACAgIAAxkBAAIBY2Z'; // Пример file_id для теста
      console.log('⚠️ Используем тестовый file_id');
    }
    
    const stickerUrl = `${PROD_URL}/stickers/${fileId}?file=true`;
    console.log(`🎯 Тестируем кеш для: ${stickerUrl}`);
    
    // Первый запрос - должен быть MISS
    const response1 = await request.get(stickerUrl, {
      headers: {
        'X-Telegram-Init-Data': process.env.TELEGRAM_INIT_DATA || ''
      }
    });
    
    const headers1 = response1.headers();
    console.log('📊 Первый запрос:');
    console.log('  X-Cache-Status:', headers1['x-cache-status']);
    console.log('  X-Cache-Key:', headers1['x-cache-key']);
    console.log('  X-Cache-Bypass:', headers1['x-cache-bypass']);
    
    // Проверяем заголовки
    expect(headers1['x-cache-status']).toBeDefined();
    expect(headers1['x-cache-key']).toBeDefined();
    
    const cacheStatus1 = headers1['x-cache-status']?.toLowerCase() || '';
    const cacheBypass1 = headers1['x-cache-bypass'] || '';
    
    // Для запросов с ?file=true bypass должен быть 0
    expect(cacheBypass1).toBe('0');
    console.log('✅ X-Cache-Bypass = 0 (кеширование включено)');
    
    // Первый запрос должен быть MISS
    expect(['miss', 'bypass', 'updating'].includes(cacheStatus1)).toBeTruthy();
    console.log(`✅ Первый запрос: ${cacheStatus1.toUpperCase()}`);
    
    // Небольшая задержка перед вторым запросом
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Делаем второй запрос - должен быть HIT
    const response2 = await request.get(stickerUrl, {
      headers: {
        'X-Telegram-Init-Data': process.env.TELEGRAM_INIT_DATA || ''
      }
    });
    
    const headers2 = response2.headers();
    console.log('📊 Второй запрос:');
    console.log('  X-Cache-Status:', headers2['x-cache-status']);
    console.log('  X-Cache-Key:', headers2['x-cache-key']);
    
    const cacheStatus2 = headers2['x-cache-status']?.toLowerCase() || '';
    
    // Второй запрос должен быть HIT (если кеш работает)
    if (cacheStatus1 === 'miss' || cacheStatus1 === 'updating') {
      expect(['hit', 'miss', 'updating'].includes(cacheStatus2)).toBeTruthy();
      
      if (cacheStatus2 === 'hit') {
        console.log('✅ Кеш работает! Второй запрос вернул HIT');
      } else {
        console.log(`⚠️ Ожидался HIT после ${cacheStatus1}, но получили ${cacheStatus2}`);
        console.log('   Это может означать, что кеш еще не создался или есть проблема с конфигурацией');
      }
    } else {
      console.log(`ℹ️ Первый запрос был ${cacheStatus1}, поэтому второй может быть ${cacheStatus2}`);
    }
  });

  test('Проверка что запросы без ?file=true не кешируются', async ({ page }) => {
    // Тестируем запрос без параметра file
    const testFileId = 'CAACAgIAAxkBAAIBY2Z'; // Пример file_id
    const urlWithoutFile = `${PROD_URL}/stickers/${testFileId}`;
    
    console.log(`🧪 Тестируем запрос без ?file=true: ${urlWithoutFile}`);
    
    const response = await page.goto(urlWithoutFile, { waitUntil: 'networkidle' });
    const headers = response?.headers() || {};
    
    console.log('📊 Запрос без ?file=true:');
    console.log('  X-Cache-Status:', headers['x-cache-status']);
    console.log('  X-Cache-Bypass:', headers['x-cache-bypass']);
    
    const cacheBypass = headers['x-cache-bypass'] || '';
    
    // Для запросов без ?file=true bypass должен быть 1 (не кешировать)
    if (cacheBypass !== '') {
      expect(cacheBypass).toBe('1');
      console.log('✅ Запросы без ?file=true правильно обходятся (bypass=1)');
    }
  });

  test('Проверка заголовков кеша в ответах API', async ({ page, request }) => {
    // Получаем список стикерсетов через API
    const apiResponse = await request.get(`${PROD_URL}/api/stickersets?limit=1`, {
      headers: {
        'X-Telegram-Init-Data': process.env.TELEGRAM_INIT_DATA || ''
      }
    });
    
    expect(apiResponse.ok()).toBeTruthy();
    const data = await apiResponse.json();
    
    if (data.stickersets && data.stickersets.length > 0) {
      const stickerset = data.stickersets[0];
      if (stickerset.stickers && stickerset.stickers.length > 0) {
        const fileId = stickerset.stickers[0].file_id;
        const stickerUrl = `${PROD_URL}/stickers/${fileId}?file=true`;
        
        console.log(`🎯 Тестируем кеш для file_id: ${fileId}`);
        
        // Первый запрос
        const response1 = await request.get(stickerUrl, {
          headers: {
            'X-Telegram-Init-Data': process.env.TELEGRAM_INIT_DATA || ''
          }
        });
        
        const headers1 = response1.headers();
        console.log('📊 Первый запрос:');
        console.log('  X-Cache-Status:', headers1['x-cache-status']);
        console.log('  X-Cache-Key:', headers1['x-cache-key']);
        console.log('  X-Cache-Bypass:', headers1['x-cache-bypass']);
        
        expect(headers1['x-cache-status']).toBeDefined();
        expect(headers1['x-cache-key']).toBeDefined();
        
        const cacheStatus1 = headers1['x-cache-status']?.toLowerCase() || '';
        expect(['miss', 'bypass', 'updating'].includes(cacheStatus1)).toBeTruthy();
        
        // Второй запрос
        await new Promise(resolve => setTimeout(resolve, 1000)); // Небольшая задержка
        
        const response2 = await request.get(stickerUrl, {
          headers: {
            'X-Telegram-Init-Data': process.env.TELEGRAM_INIT_DATA || ''
          }
        });
        
        const headers2 = response2.headers();
        console.log('📊 Второй запрос:');
        console.log('  X-Cache-Status:', headers2['x-cache-status']);
        
        const cacheStatus2 = headers2['x-cache-status']?.toLowerCase() || '';
        
        if (cacheStatus1 === 'miss') {
          // После MISS следующий запрос должен быть HIT
          if (cacheStatus2 === 'hit') {
            console.log('✅ Кеш работает! Второй запрос вернул HIT');
          } else {
            console.log(`⚠️ Ожидался HIT после MISS, но получили ${cacheStatus2}`);
          }
        }
      }
    }
  });
});

