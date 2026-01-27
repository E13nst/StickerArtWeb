/**
 * Утилиты для работы со стикерами
 */

/**
 * Определяет платформу устройства
 * @param telegram - Telegram WebApp объект (опционально)
 * @returns Информация о платформе
 */
export function getPlatformInfo(telegram?: any): {
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isWeb: boolean;
  isMobile: boolean;
  platform: string;
} {
  let platform = 'unknown';
  let isIOS = false;
  let isAndroid = false;
  let isDesktop = false;
  let isWeb = false;

  // Проверяем platform из Telegram WebApp
  if (telegram?.platform) {
    platform = telegram.platform.toLowerCase();
    isIOS = platform === 'ios' || platform === 'iphone' || platform === 'ipad';
    isAndroid = platform === 'android';
    isDesktop = platform === 'tdesktop' || platform === 'desktop' || platform === 'macos' || platform === 'windows' || platform === 'linux';
    isWeb = platform === 'web' || platform === 'weba';
  }

  // Fallback на user agent, если platform не определен
  if (platform === 'unknown' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    isIOS = /ipad|iphone|ipod/.test(ua);
    isAndroid = /android/.test(ua);
    isDesktop = !isIOS && !isAndroid && (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux'));
    isWeb = !isIOS && !isAndroid && !isDesktop;
    
    if (isIOS) platform = 'ios';
    else if (isAndroid) platform = 'android';
    else if (isDesktop) platform = 'desktop';
    else platform = 'web';
  }

  const isMobile = isIOS || isAndroid;

  return {
    isIOS,
    isAndroid,
    isDesktop,
    isWeb,
    isMobile,
    platform
  };
}

const readEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    const value = import.meta.env[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  } catch {
    return undefined;
  }
};

const STICKER_PROCESSOR_URL = readEnv('VITE_STICKER_PROCESSOR_URL');
const STICKER_PROCESSOR_PATH = readEnv('VITE_STICKER_PROCESSOR_PATH') || '/stickers';

const normalizeAbsoluteBase = (value: string): string => {
  if (!value) {
    return '';
  }
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
};

const normalizeRelativeBase = (value: string): string => {
  if (!value) {
    return '';
  }
  const trimmed = value.replace(/\/+$/, '').trim();
  if (trimmed === '') {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

let cachedStickerBaseUrl: string | null = null;

export const getStickerBaseUrl = (): string => {
  if (cachedStickerBaseUrl) {
    return cachedStickerBaseUrl;
  }

  if (STICKER_PROCESSOR_URL) {
    cachedStickerBaseUrl = normalizeAbsoluteBase(STICKER_PROCESSOR_URL);
    return cachedStickerBaseUrl;
  }

  cachedStickerBaseUrl = normalizeRelativeBase(STICKER_PROCESSOR_PATH);
  return cachedStickerBaseUrl;
};

const serializeQueryParams = (params: Record<string, string | number | boolean | undefined>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.append(key, String(value));
  });
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
};

export const buildStickerUrl = (
  fileId: string,
  params: Record<string, string | number | boolean | undefined> = {}
): string => {
  if (!fileId) {
    return '';
  }

  const base = getStickerBaseUrl();
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const query = serializeQueryParams(params);
  return `${normalizedBase}/${encodeURIComponent(fileId)}${query}`;
};

/**
 * Получить URL изображения стикера по file_id
 * @param fileId - Telegram file_id стикера
 * @returns URL для загрузки изображения стикера
 */
export function getStickerImageUrl(fileId: string): string {
  if (!fileId) {
    return '';
  }
  return buildStickerUrl(fileId, { file: true });
}

/**
 * Получить URL миниатюры стикера (для превью в списках)
 * @param fileId - Telegram file_id стикера
 * @param size - Размер миниатюры (по умолчанию 128x128)
 * @returns URL для загрузки миниатюры
 */
export function getStickerThumbnailUrl(fileId: string, size: number = 128): string {
  if (!fileId) {
    return '';
  }
  return buildStickerUrl(fileId, { file: true, size });
}

/**
 * Получить URL видео стикера по file_id
 * @param fileId - Telegram file_id стикера
 * @returns URL для загрузки видео стикера (WebM)
 */
export function getStickerVideoUrl(fileId: string): string {
  if (!fileId) {
    return '';
  }
  // Используем тот же endpoint, что и для изображений, но явно указываем, что это видео
  return buildStickerUrl(fileId, { file: true });
}

/**
 * Получить случайные стикеры из набора
 * @param stickers - Массив стикеров
 * @param count - Количество стикеров для выбора
 * @param seed - Опциональный seed для детерминированного выбора
 * @returns Массив случайно выбранных стикеров
 */
export function getRandomStickersFromSet<T>(
  stickers: T[], 
  count: number, 
  seed?: string
): T[] {
  if (!stickers || stickers.length === 0) return [];
  
  // Фильтруем валидные стикеры (не null/undefined)
  const validStickers = stickers.filter(sticker => sticker != null);
  if (validStickers.length === 0) return [];
  
  // Если валидных стикеров меньше или равно нужному количеству, возвращаем все
  if (validStickers.length <= count) {
    return [...validStickers];
  }
  
  // Создаем копию массива для перемешивания
  const shuffledStickers = [...validStickers];
  
  if (seed) {
    // Детерминированное перемешивание с seed
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = ((state << 5) - state + seed.charCodeAt(i)) & 0xffffffff;
    }
    
    const seededRandom = () => {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return state / 0x100000000;
    };
    
    // Fisher-Yates shuffle с seeded random
    for (let i = shuffledStickers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [shuffledStickers[i], shuffledStickers[j]] = [shuffledStickers[j], shuffledStickers[i]];
    }
  } else {
    // Полностью случайное перемешивание
    for (let i = shuffledStickers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledStickers[i], shuffledStickers[j]] = [shuffledStickers[j], shuffledStickers[i]];
    }
  }
  
  return shuffledStickers.slice(0, count);
}

/**
 * Форматирует название стикера для отображения, обрабатывая упоминания (@)
 * @param title - Название стикера
 * @returns Отформатированное название
 * 
 * @example
 * formatStickerTitle("Pepe the Frog @flowwercat") // "Pepe the Frog"
 * formatStickerTitle("@iTONSPACE @TON_AppBot") // "iTONSPACE"
 * formatStickerTitle("@HappySeals") // "HappySeals"
 * formatStickerTitle("@mention text") // "text"
 * formatStickerTitle("@mention1 @mention2 text") // "text"
 * formatStickerTitle("text1 @mention1 text2 @mention2") // "text1 text2"
 * formatStickerTitle("Pepe the Frog") // "Pepe the Frog"
 */
export function formatStickerTitle(title: string | null | undefined): string {
  if (!title) {
    return '';
  }

  const trimmed = title.trim();
  if (!trimmed) {
    return '';
  }

  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) {
    // Нет символа @, возвращаем как есть
    return trimmed;
  }

  // Обрабатываем всю строку: собираем весь обычный текст, пропуская упоминания
  const textParts: string[] = [];
  let firstMention = '';
  let currentIndex = 0;
  let textStart = 0;
  let hasTextBeforeMentions = false;

  while (currentIndex < trimmed.length) {
    if (trimmed[currentIndex] === '@') {
      // Нашли упоминание
      // Сохраняем текст до упоминания, если он есть
      if (textStart < currentIndex) {
        const textPart = trimmed.substring(textStart, currentIndex).trim();
        if (textPart) {
          textParts.push(textPart);
          hasTextBeforeMentions = true;
        }
      }

      // Извлекаем упоминание (до пробела или конца строки)
      const mentionStart = currentIndex + 1; // Пропускаем @
      let mentionEnd = mentionStart;
      
      while (mentionEnd < trimmed.length && trimmed[mentionEnd] !== ' ') {
        mentionEnd++;
      }
      
      // Сохраняем первое упоминание без @ (если еще не сохранили)
      if (!firstMention && !hasTextBeforeMentions) {
        firstMention = trimmed.substring(mentionStart, mentionEnd);
      }
      
      // Пропускаем упоминание
      currentIndex = mentionEnd;
      
      // Пропускаем пробелы после упоминания
      while (currentIndex < trimmed.length && trimmed[currentIndex] === ' ') {
        currentIndex++;
      }
      
      textStart = currentIndex;
    } else {
      currentIndex++;
    }
  }

  // Добавляем оставшийся текст после последнего упоминания
  if (textStart < trimmed.length) {
    const textPart = trimmed.substring(textStart).trim();
    if (textPart) {
      textParts.push(textPart);
    }
  }

  // Если есть обычный текст (до или после упоминаний), возвращаем его
  const result = textParts.filter(part => part.length > 0).join(' ').trim();
  if (result) {
    return result;
  }

  // Если был только текст до упоминаний, но он был пустым, или только упоминания
  // Возвращаем первое упоминание без @
  return firstMention;
}

/**
 * Удаляет невидимые символы из строки (U+200B, U+2060 и другие)
 * @param text - Текст для очистки
 * @returns Очищенный текст
 */
export function removeInvisibleChars(text: string): string {
  if (!text || typeof text !== 'string') return text;
  // Удаляем Zero Width Space (U+200B), Word Joiner (U+2060), и другие невидимые символы
  return text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

/**
 * Строит inline query строку для share URL (с @bot в начале)
 * @param fileId - Telegram file_id стикера
 * @param botUsername - Имя бота (без @)
 * @returns Очищенная строка для inline query: "@bot fileId"
 */
export function buildInlineQuery(fileId: string, botUsername: string = 'stixlybot'): string {
  const cleanBotUsername = botUsername.startsWith('@') ? botUsername.slice(1) : botUsername;
  const cleanFileId = removeInvisibleChars(fileId);
  // Гарантируем отсутствие пробелов/невидимых символов перед @
  return `@${cleanBotUsername} ${cleanFileId}`.trim();
}

/**
 * Строит query строку для switchInlineQuery (БЕЗ @bot, так как Telegram добавляет его автоматически)
 * @param fileId - Telegram file_id стикера
 * @returns Очищенный fileId без @bot
 */
export function buildSwitchInlineQuery(fileId: string): string {
  // switchInlineQuery автоматически добавляет "@bot" к query, поэтому передаем только fileId
  return removeInvisibleChars(fileId).trim();
}

/**
 * Создает fallback share URL для случаев, когда WebApp API недоступен
 * Использует createTelegramShareUrl для единообразия и корректного формата
 * 
 * Формат URL: https://t.me/stixlybot?text=@stixlybot%20[fileId]
 * Этот формат работает на всех платформах:
 * - iOS: открывает выбор чата с предзаполненным текстом
 * - Android: открывает выбор чата с предзаполненным текстом
 * - Desktop: открывает выбор чата с предзаполненным текстом
 * - Web: открывает выбор чата с предзаполненным текстом
 * 
 * @param fileId - Telegram file_id стикера
 * @param botUsername - Имя бота (без @)
 * @returns URL для открытия выбора чата с предзаполненным текстом
 */
export function buildFallbackShareUrl(fileId: string, botUsername: string = 'stixlybot'): string {
  // Используем createTelegramShareUrl с useDirectBotLink для корректного триггера inline режима
  // Прямой deep link к боту лучше работает на всех платформах
  return createTelegramShareUrl(botUsername, fileId, { useDirectBotLink: true });
}

/**
 * Валидирует формат Telegram file_id
 * @param fileId - Telegram file_id для валидации
 * @returns true если формат валиден
 */
export function isValidTelegramFileId(fileId: string): boolean {
  if (!fileId || typeof fileId !== 'string') {
    return false;
  }
  // Telegram file_id обычно содержит только буквы, цифры, дефисы и подчеркивания
  // Длина может варьироваться, но обычно не превышает 200 символов
  return /^[A-Za-z0-9_-]{1,200}$/.test(fileId);
}

/**
 * Создает Telegram share URL с предзаполненным текстом для триггера inline режима бота
 * 
 * ВАЖНО: Для корректного триггера inline режима бота (@username) в начале текста
 * НЕ используем невидимые символы, так как они мешают Telegram распознать начало inline-запроса.
 * 
 * Telegram автоматически добавляет пробел перед @ в начале текста через t.me/share/url,
 * поэтому для триггера inline режима используем прямой deep link к боту через t.me/bot?text=...
 * 
 * @param botUsername - Имя бота (без @)
 * @param text - Текст сообщения после @username (обычно file_id для inline запроса)
 * @param options - Опции для настройки поведения
 * @returns URL для открытия выбора чата с предзаполненным текстом, который триггерит inline режим
 * 
 * @example
 * createTelegramShareUrl('stixlybot', 'CAACAgIAAxkBAAIBY2...')
 * // Возвращает: https://t.me/stixlybot?text=CAACAgIAAxkBAAIBY2...
 * 
 * @see https://core.telegram.org/api/links - Документация по deep links (Bot links)
 */
export function createTelegramShareUrl(
  botUsername: string,
  text: string,
  options: {
    /**
     * URL для шаринга (по умолчанию пустая строка)
     * Если указан, используется формат t.me/share/url вместо прямого deep link к боту
     */
    shareUrl?: string;
    /**
     * Использовать прямой deep link к боту вместо share URL
     * Прямой deep link лучше триггерит inline режим на всех платформах
     */
    useDirectBotLink?: boolean;
  } = {}
): string {
  const { shareUrl = '', useDirectBotLink = true } = options;
  
  // Валидация botUsername
  if (!botUsername || typeof botUsername !== 'string') {
    throw new Error('botUsername должен быть непустой строкой');
  }
  
  // Убираем @ из начала botUsername, если он есть
  const cleanBotUsername = botUsername.startsWith('@') 
    ? botUsername.slice(1) 
    : botUsername;
  
  if (!cleanBotUsername.trim()) {
    throw new Error('botUsername не может быть пустым');
  }
  
  // Очищаем текст от невидимых символов
  const cleanText = removeInvisibleChars(text);
  
  // Если указан shareUrl или useDirectBotLink = false, используем формат share/url
  if (shareUrl && !useDirectBotLink) {
    const messageText = `@${cleanBotUsername}${cleanText ? ` ${cleanText}` : ''}`;
    const encodedText = encodeURIComponent(messageText);
    const encodedUrl = encodeURIComponent(shareUrl);
    return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  }
  
  // Прямой deep link к боту (основной путь)
  // Формат: https://t.me/bot?text=@bot%20fileId
  // Этот формат корректно работает на всех платформах:
  // - Открывает окно выбора чата
  // - Предзаполняет текст "@bot fileId"
  // - Триггерит inline режим бота
  const messageText = `@${cleanBotUsername}${cleanText ? ` ${cleanText}` : ''}`;
  const encodedText = encodeURIComponent(messageText);
  return `https://t.me/${cleanBotUsername}?text=${encodedText}`;
}

/**
 * Создает Telegram deep link (tg://) для шаринга
 * Альтернатива для мобильных устройств
 * 
 * @param botUsername - Имя бота (без @)
 * @param text - Текст сообщения (обычно file_id для inline запроса)
 * @param options - Опции для настройки поведения
 * @returns Deep link URL (tg://resolve для прямого deep link к боту)
 */
export function createTelegramDeepLink(
  botUsername: string,
  text: string,
  options: {
    shareUrl?: string;
    useDirectBotLink?: boolean;
  } = {}
): string {
  const { shareUrl = '', useDirectBotLink = true } = options;
  
  // Убираем @ из начала botUsername, если он есть
  const cleanBotUsername = botUsername.startsWith('@') 
    ? botUsername.slice(1) 
    : botUsername;
  
  // Очищаем текст от невидимых символов
  const cleanText = removeInvisibleChars(text);
  
  // Если указан shareUrl или useDirectBotLink = false, используем формат msg_url
  if (shareUrl || !useDirectBotLink) {
    const messageText = `@${cleanBotUsername}${cleanText ? ` ${cleanText}` : ''}`;
    const encodedText = encodeURIComponent(messageText);
    const encodedUrl = encodeURIComponent(shareUrl);
    return `tg://msg_url?url=${encodedUrl}&text=${encodedText}`;
  }
  
  // Прямой deep link к боту с текстом "@bot text" для триггера inline режима
  // Формат: tg://resolve?domain=<bot_username>&text=@bot%20text
  // ВАЖНО: Включаем @username в текст для корректного триггера inline режима
  const messageText = `@${cleanBotUsername}${cleanText ? ` ${cleanText}` : ''}`;
  const encodedText = encodeURIComponent(messageText);
  return `tg://resolve?domain=${cleanBotUsername}&text=${encodedText}`;
}

