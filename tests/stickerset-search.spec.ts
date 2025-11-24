import { test, expect, Page } from '@playwright/test';

// @ts-ignore - process доступен в Node.js окружении Playwright
declare const process: any;

/**
 * 🔍 ТЕСТ ПОИСКА И ПРОСМОТРА СТИКЕРСЕТА
 * 
 * Цель: Проверить работу поиска стикерсета "Cattea Chaos",
 * открытие модального окна просмотра и загрузку миниатюр с анимациями
 */

test.describe('StickerSet Search and View: Cattea Chaos', () => {
  test.setTimeout(120000); // 2 минуты на тест
  
  test('Поиск стикерсета "Cattea Chaos", открытие и проверка загрузки миниатюр', async ({ page }) => {
    console.log('🚀 Начало теста поиска стикерсета "Cattea Chaos"...\n');
    
    // ════════════════════════════════════════════════════════════════════════
    // 1. НАСТРОЙКА АВТОРИЗАЦИИ
    // ════════════════════════════════════════════════════════════════════════
    const initData = process.env.TELEGRAM_INIT_DATA || '';
    if (initData) {
      await page.route('**/*', async (route) => {
        const headers = {
          ...route.request().headers(),
          'X-Telegram-Init-Data': initData
        };
        await route.continue({ headers });
      });
      console.log('✅ Авторизация настроена через X-Telegram-Init-Data');
    } else {
      console.log('⚠️  TELEGRAM_INIT_DATA не задан, тест может не пройти');
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // 2. ПЕРЕХОД НА СТРАНИЦУ ГАЛЕРЕИ
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📄 Переход на страницу галереи...');
    await page.goto('/miniapp/', { waitUntil: 'domcontentloaded' });
    
    // Ждем появления контейнера галереи
    await page.waitForSelector('[data-testid="gallery-container"]', { timeout: 15000 });
    console.log('✅ Галерея загружена');
    
    // Ждем загрузки хотя бы нескольких стикерсетов
    await page.waitForSelector('[data-testid="pack-card"]', { timeout: 10000 });
    const initialCount = await page.locator('[data-testid="pack-card"]').count();
    console.log(`✅ Загружено ${initialCount} стикерсетов`);
    
    // ════════════════════════════════════════════════════════════════════════
    // 3. ПОИСК СТИКЕРСЕТА "CATTEA CHAOS"
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Поиск стикерсета "Cattea Chaos"...');
    
    // Сначала открываем поиск - кликаем на кнопку лупы (SearchIcon)
    console.log('  📍 Открытие поля поиска...');
    
    // Используем JavaScript для клика на кнопку поиска (обходим проблемы с позиционированием)
    await page.evaluate(() => {
      // Ищем кнопку с иконкой поиска (SearchIcon)
      const buttons = Array.from(document.querySelectorAll('button'));
      const searchButton = buttons.find(btn => {
        const svg = btn.querySelector('svg');
        // Проверяем что это MUI SearchIcon по data-testid или aria-label
        return svg && (
          btn.getAttribute('aria-label')?.toLowerCase().includes('search') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('поиск') ||
          svg.querySelector('path[d*="M15.5"]') !== null // SearchIcon path
        );
      });
      
      if (searchButton) {
        searchButton.click();
        return true;
      }
      
      // Альтернатива: просто ищем первую кнопку с SVG в CompactControlsBar
      const compactBar = document.querySelector('[class*="CompactControls"]');
      if (compactBar) {
        const firstButton = compactBar.querySelector('button');
        if (firstButton) {
          firstButton.click();
          return true;
        }
      }
      
      return false;
    });
    
    console.log('  ✅ Кнопка поиска нажата');
    
    // Даем время для анимации раскрытия
    await page.waitForTimeout(500);
    
    // Теперь ищем поле поиска по data-testid
    const searchInput = page.locator('[data-testid="search-input"]').first();
    
    // Ждем появления поля поиска
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Поле поиска раскрыто и видно');
    
    // Используем JavaScript для прямого ввода текста в поле (обходим любые UI проблемы)
    await page.evaluate((searchText) => {
      const input = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
      if (input) {
        // Устанавливаем значение напрямую
        input.value = searchText;
        
        // Триггерим события изменения для React
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, searchText);
        }
        
        // Генерируем события
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Нажимаем Enter для запуска поиска
        input.dispatchEvent(new KeyboardEvent('keypress', { 
          key: 'Enter', 
          code: 'Enter', 
          keyCode: 13, 
          bubbles: true 
        }));
      }
    }, 'Cattea Chaos');
    
    console.log('✅ Введен текст поиска: "Cattea Chaos" через JavaScript');
    
    // Ждем появления результатов поиска
    await page.waitForTimeout(1000); // Даем время для debounce
    
    // Проверяем результаты поиска
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('[data-testid="pack-card"]');
      return cards.length > 0;
    }, { timeout: 10000 });
    
    const searchResultsCount = await page.locator('[data-testid="pack-card"]').count();
    console.log(`✅ Найдено ${searchResultsCount} результатов поиска`);
    
    // Находим карточку с "Cattea Chaos" в названии
    const catteaChaosCard = page.locator('[data-testid="pack-card"]').filter({
      hasText: /Cattea\s+Chaos/i
    }).first();
    
    const cardExists = await catteaChaosCard.count() > 0;
    expect(cardExists).toBeTruthy();
    console.log('✅ Найдена карточка стикерсета "Cattea Chaos"');
    
    // ════════════════════════════════════════════════════════════════════════
    // 4. ОТКРЫТИЕ СТИКЕРСЕТА ДЛЯ ПРОСМОТРА
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n📦 Открытие стикерсета для просмотра...');
    
    // Кликаем на карточку через JavaScript (обходим проблемы с "нестабильным" элементом)
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="pack-card"]'));
      const targetCard = cards.find(card => {
        const text = card.textContent || '';
        return /Cattea\s+Chaos/i.test(text);
      });
      
      if (targetCard) {
        (targetCard as HTMLElement).click();
        return true;
      }
      return false;
    });
    
    console.log('✅ Клик по карточке выполнен через JavaScript');
    
    // Даем время для начала анимации открытия модального окна
    await page.waitForTimeout(500);
    
    // Ждем открытия модального окна просмотра
    // Проверяем что body получил класс modal-lock (означает что модальное окно открыто)
    await page.waitForFunction(() => {
      return document.body.classList.contains('modal-lock') ||
             document.documentElement.classList.contains('modal-lock');
    }, { timeout: 10000 });
    
    console.log('✅ Модальное окно просмотра открыто (modal-lock активен)');
    
    // ════════════════════════════════════════════════════════════════════════
    // 5. ПРОВЕРКА ЗАГРУЗКИ ПЕРВОЙ АНИМАЦИИ
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🎬 Проверка загрузки первой анимации...');
    
    // Ждем пока загрузится первая (главная) анимация в модальном окне
    const firstAnimationLoaded = await page.waitForFunction(() => {
      // Ищем большой элемент (главное превью, не миниатюры) с загруженным медиа
      const allMedia = document.querySelectorAll('img, video, canvas, svg');
      
      for (const el of Array.from(allMedia)) {
        const rect = el.getBoundingClientRect();
        
        // Ищем крупный элемент (>150px) - это главное превью
        if (rect.width > 150 && rect.height > 150 && rect.top >= 0 && rect.left >= 0) {
          if (el.tagName === 'IMG') {
            const img = el as HTMLImageElement;
            if (img.src && img.src !== '' && img.complete && img.naturalWidth > 0) {
              return true;
            }
          } else if (el.tagName === 'VIDEO') {
            const video = el as HTMLVideoElement;
            if (video.src && video.src !== '' && video.readyState >= 2) {
              return true;
            }
          } else if (el.tagName === 'CANVAS') {
            const canvas = el as HTMLCanvasElement;
            if (canvas.width > 0 && canvas.height > 0) {
              return true;
            }
          } else if (el.tagName === 'svg') {
            const svg = el as SVGElement;
            if (svg.children.length > 0) {
              return true;
            }
          }
        }
      }
      return false;
    }, { timeout: 15000 });
    
    expect(firstAnimationLoaded).toBeTruthy();
    console.log('✅ Первая анимация загружена и отображается');
    
    // ════════════════════════════════════════════════════════════════════════
    // 6. ПРОВЕРКА ЗАГРУЗКИ ПЕРВЫХ 10 МИНИАТЮР
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🖼️  Проверка загрузки миниатюр...');
    
    // Ищем миниатюры по атрибуту data-thumbnail-index
    const thumbnails = page.locator('[data-thumbnail-index]');
    
    // Ждем загрузки хотя бы 10 миниатюр
    await page.waitForFunction((minCount) => {
      const items = document.querySelectorAll('[data-thumbnail-index]');
      return items.length >= minCount;
    }, 10, { timeout: 15000 });
    
    const thumbnailCount = await thumbnails.count();
    console.log(`✅ Найдено ${thumbnailCount} миниатюр`);
    expect(thumbnailCount).toBeGreaterThanOrEqual(10);
    
    // Проверяем что первые 10 миниатюр имеют загруженное изображение/видео
    console.log('\n🔍 Проверка загрузки медиа в миниатюрах...');
    for (let i = 0; i < Math.min(10, thumbnailCount); i++) {
      const thumbnail = page.locator(`[data-thumbnail-index="${i}"]`);
      
      // Проверяем наличие медиа элемента (img, video, canvas)
      const hasMedia = await thumbnail.evaluate((el) => {
        const img = el.querySelector('img');
        const video = el.querySelector('video');
        const canvas = el.querySelector('canvas');
        const svg = el.querySelector('svg');
        
        const hasImage = img && img.src && img.src !== '';
        const hasVideo = video && video.src && video.src !== '';
        const hasCanvas = !!canvas;
        const hasSvg = !!svg;
        
        return hasImage || hasVideo || hasCanvas || hasSvg;
      });
      
      expect(hasMedia).toBeTruthy();
      console.log(`  ✅ Миниатюра ${i + 1}: медиа загружено`);
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // 7. КЛИК ПО КАЖДОЙ МИНИАТЮРЕ И ПРОВЕРКА АНИМАЦИИ
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🎬 Проверка анимаций при клике по миниатюрам...');
    
    // Кликаем по первым 10 миниатюрам и проверяем загрузку анимации
    const testCount = Math.min(10, thumbnailCount);
    for (let i = 0; i < testCount; i++) {
      console.log(`\n  🖱️  Клик по миниатюре ${i + 1}...`);
      
      const thumbnail = page.locator(`[data-thumbnail-index="${i}"]`);
      await thumbnail.click();
      
      // Ждем небольшую задержку для загрузки анимации
      await page.waitForTimeout(800);
      
      // Проверяем что анимация загружена - ищем активный медиа элемент в модальном окне
      const animationLoaded = await page.evaluate(() => {
        // Ищем все img/video/canvas/svg в модальном окне
        const allMedia = document.querySelectorAll('img, video, canvas, svg');
        
        // Фильтруем только видимые элементы (не миниатюры)
        for (const el of Array.from(allMedia)) {
          const rect = el.getBoundingClientRect();
          // Проверяем что элемент достаточно большой (не миниатюра) и видимый
          if (rect.width > 100 && rect.height > 100 && rect.top >= 0 && rect.left >= 0) {
            if (el.tagName === 'IMG') {
              const img = el as HTMLImageElement;
              if (img.src && img.src !== '' && img.complete) return true;
            } else if (el.tagName === 'VIDEO') {
              const video = el as HTMLVideoElement;
              if (video.src && video.src !== '') return true;
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
      });
      
      expect(animationLoaded).toBeTruthy();
      console.log(`  ✅ Миниатюра ${i + 1}: анимация загружена и отображается`);
    }
    
    console.log('\n═'.repeat(80));
    console.log('✅ ТЕСТ ЗАВЕРШЕН УСПЕШНО');
    console.log(`   - Найден стикерсет "Cattea Chaos"`);
    console.log(`   - Проверено ${testCount} миниатюр`);
    console.log(`   - Все анимации загружены корректно`);
    console.log('═'.repeat(80) + '\n');
  });
  
  test('Альтернативный поиск через API endpoint @api', async ({ page }) => {
    console.log('🚀 Альтернативный тест: Поиск через API...\n');
    
    // Настройка авторизации
    const initData = process.env.TELEGRAM_INIT_DATA || '';
    if (initData) {
      await page.route('**/*', async (route) => {
        const headers = {
          ...route.request().headers(),
          'X-Telegram-Init-Data': initData
        };
        await route.continue({ headers });
      });
    }
    
    // Делаем прямой API запрос для поиска
    console.log('🔍 Поиск через API endpoint...');
    const apiUrl = process.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io';
    
    const response = await page.request.get(`${apiUrl}/api/stickersets/search?name=Cattea%20Chaos`, {
      headers: {
        'X-Telegram-Init-Data': initData
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    console.log(`✅ API вернул ${data.length} результатов`);
    expect(data.length).toBeGreaterThan(0);
    
    // Проверяем что в результатах есть "Cattea Chaos"
    const catteaChaos = data.find((item: any) => 
      item.title?.toLowerCase().includes('cattea chaos') ||
      item.name?.toLowerCase().includes('cattea')
    );
    
    expect(catteaChaos).toBeTruthy();
    console.log(`✅ Найден стикерсет:`, {
      id: catteaChaos.id,
      name: catteaChaos.name,
      title: catteaChaos.title,
      stickersCount: catteaChaos.stickers?.length || 0
    });
    
    // Проверяем что в стикерсете есть хотя бы 10 стикеров
    const stickersCount = catteaChaos.stickers?.length || 0;
    expect(stickersCount).toBeGreaterThanOrEqual(10);
    console.log(`✅ В стикерсете ${stickersCount} стикеров (минимум 10)`);
    
    console.log('\n✅ API тест завершен успешно\n');
  });
});

