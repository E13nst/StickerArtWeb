import axios, { AxiosInstance } from 'axios';
import { StickerSetListResponse, StickerSetResponse, AuthResponse, StickerSetMeta, ProfileResponse, CategoryResponse, CreateStickerSetRequest, CreateStickerSetCreateRequest, CategorySuggestionResult, LeaderboardResponse, AuthorsLeaderboardResponse, UserWallet, DonationPrepareResponse, DonationConfirmResponse, SwipeStatsResponse } from '../types/sticker';
import { UserInfo } from '../store/useProfileStore';
import { mockStickerSets } from '../data/mockData';
import { buildStickerUrl } from '@/utils/stickerUtils';
import { requestDeduplicator } from '@/utils/requestDeduplication';
import { getInitData } from '../telegram/launchParams';

function readEnv(key: string): string | undefined {
  try {
    const value = (import.meta as any).env?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

const STICKER_PROCESSOR_URL = readEnv('VITE_STICKER_PROCESSOR_URL')?.replace(/\/+$/, '') ?? '';
const UPLOAD_IMAGE_MAX_DIMENSION = 1024;
const UPLOAD_IMAGE_MAX_BYTES = 2_900_000;
const UPLOAD_IMAGE_REPROCESS_THRESHOLD_BYTES = 2_700_000;
const SOURCE_IMAGE_UPLOAD_BATCH_BYTES = 4_000_000;
const JPEG_UPLOAD_QUALITIES = [0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72] as const;

function getStickerProcessorEndpoint(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return STICKER_PROCESSOR_URL ? `${STICKER_PROCESSOR_URL}${normalizedPath}` : normalizedPath;
}

/** Извлекает текст ошибки из ответа сервера (JSON или строка) для отображения пользователю */
function getErrorMessage(error: any, fallback: string): string {
  const status = error?.response?.status;
  if (status === 413) {
    return 'Изображение слишком большое. Попробуйте выбрать другое фото или уменьшить его размер.';
  }

  const data = error?.response?.data;
  if (data == null) return fallback;
  if (typeof data === 'string' && data.length > 0 && data.length < 500) {
    const trimmed = data.trim();
    const looksLikeHtml = /^<!doctype|^<html[\s>]|^<head[\s>]|^<body[\s>]|<h1[\s>]|<\/html>$/i.test(trimmed);
    if (!looksLikeHtml) {
      return trimmed;
    }
  }
  if (typeof data === 'object') {
    const msg = data.message ?? data.error ?? data.errorMessage;
    if (typeof msg === 'string' && msg.length > 0) return msg;
    const detail = data.detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && detail[0].message) return detail[0].message;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'string') return detail[0];
  }
  return fallback;
}

function extractUploadedImageIds(payload: any): string[] {
  const imageIds = new Set<string>();

  const collect = (value: any) => {
    if (!value) return;

    if (typeof value === 'string') {
      if (value.startsWith('img_')) {
        imageIds.add(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    const directKeys = ['image_id', 'imageId'];
    directKeys.forEach((key) => {
      const directValue = value[key];
      if (typeof directValue === 'string' && directValue.startsWith('img_')) {
        imageIds.add(directValue);
      }
    });

    const arrayKeys = ['image_ids', 'imageIds', 'images', 'files', 'data', 'result'];
    arrayKeys.forEach((key) => {
      if (key in value) {
        collect(value[key]);
      }
    });

    Object.values(value).forEach((nestedValue) => {
      if (nestedValue && typeof nestedValue === 'object') {
        collect(nestedValue);
      }
    });
  };

  collect(payload);

  return Array.from(imageIds);
}

function splitFilesIntoUploadBatches(files: File[], maxBatchBytes: number): File[][] {
  const batches: File[][] = [];
  let currentBatch: File[] = [];
  let currentBatchBytes = 0;

  files.forEach((file) => {
    const nextBatchBytes = currentBatchBytes + file.size;
    if (currentBatch.length > 0 && nextBatchBytes > maxBatchBytes) {
      batches.push(currentBatch);
      currentBatch = [file];
      currentBatchBytes = file.size;
      return;
    }

    currentBatch.push(file);
    currentBatchBytes = nextBatchBytes;
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };

    image.src = objectUrl;
  });
}

type DecodedUploadImage =
  | {
      width: number;
      height: number;
      draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
      release: () => void;
    }
  | {
      width: number;
      height: number;
      draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
      release: () => void;
    };

async function decodeUploadImage(blob: Blob): Promise<DecodedUploadImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (context, width, height) => {
          context.drawImage(bitmap, 0, 0, width, height);
        },
        release: () => {
          bitmap.close();
        },
      };
    } catch {
      // Fallback to HTMLImageElement below when createImageBitmap is unavailable or fails.
    }
  }

  const image = await loadImageElement(blob);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    draw: (context, width, height) => {
      context.drawImage(image, 0, 0, width, height);
    },
    release: () => {},
  };
}

function getScaledDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function createOptimizedUploadBlob(
  canvas: HTMLCanvasElement,
  hasTransparency: boolean,
): Promise<{ blob: Blob; mimeType: string } | null> {
  const mimeTypeCandidates = hasTransparency
    ? (['image/png', 'image/jpeg'] as const)
    : (['image/jpeg'] as const);

  let bestCandidate: { blob: Blob; mimeType: string } | null = null;

  for (const mimeType of mimeTypeCandidates) {
    const qualityCandidates = mimeType === 'image/png' ? [undefined] : [...JPEG_UPLOAD_QUALITIES];

    for (const quality of qualityCandidates) {
      const exportCanvas = mimeType === 'image/jpeg'
        ? document.createElement('canvas')
        : canvas;

      if (mimeType === 'image/jpeg') {
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportContext = exportCanvas.getContext('2d');
        if (!exportContext) {
          continue;
        }

        exportContext.fillStyle = '#ffffff';
        exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportContext.drawImage(canvas, 0, 0);
      }

      const candidateBlob = await canvasToBlob(exportCanvas, mimeType, quality);
      if (!candidateBlob) {
        continue;
      }

      if (!bestCandidate || candidateBlob.size < bestCandidate.blob.size) {
        bestCandidate = { blob: candidateBlob, mimeType };
      }

      if (candidateBlob.size <= UPLOAD_IMAGE_MAX_BYTES) {
        return { blob: candidateBlob, mimeType };
      }
    }
  }

  return bestCandidate;
}

function canvasHasTransparency(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return false;
  }

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }

  return false;
}

async function optimizeUploadImage(file: File): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  let decodedImage: DecodedUploadImage | null = null;

  try {
    decodedImage = await decodeUploadImage(file);
    const originalWidth = decodedImage.width;
    const originalHeight = decodedImage.height;
    const scaled = getScaledDimensions(originalWidth, originalHeight, UPLOAD_IMAGE_MAX_DIMENSION);
    const shouldResize = scaled.width !== originalWidth || scaled.height !== originalHeight;
    const shouldReprocess = shouldResize || file.size > UPLOAD_IMAGE_REPROCESS_THRESHOLD_BYTES;

    if (!shouldReprocess) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    decodedImage.draw(context, scaled.width, scaled.height);

    const hasTransparency = file.type !== 'image/jpeg' && canvasHasTransparency(canvas);
    const optimizedResult = await createOptimizedUploadBlob(canvas, hasTransparency);
    const optimizedBlob = optimizedResult?.blob ?? null;
    const targetMimeType = optimizedResult?.mimeType ?? (hasTransparency ? 'image/png' : 'image/jpeg');

    if (!optimizedBlob) {
      if (file.size <= UPLOAD_IMAGE_MAX_BYTES && !shouldResize) {
        return file;
      }
      throw new Error('UPLOAD_TOO_LARGE');
    }

    if (optimizedBlob.size > UPLOAD_IMAGE_MAX_BYTES) {
      if (file.size <= UPLOAD_IMAGE_MAX_BYTES && !shouldResize) {
        return file;
      }
      throw new Error('UPLOAD_TOO_LARGE');
    }

    const shouldUseOptimizedFile =
      shouldResize ||
      optimizedBlob.size < file.size ||
      targetMimeType !== file.type ||
      file.size > UPLOAD_IMAGE_MAX_BYTES;

    if (!shouldUseOptimizedFile) {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'source-image';
    const nextExtension = targetMimeType === 'image/png' ? 'png' : 'jpg';
    return new File([optimizedBlob], `${baseName}.${nextExtension}`, {
      type: optimizedBlob.type || targetMimeType,
      lastModified: file.lastModified,
    });
  } catch {
    if (file.size > UPLOAD_IMAGE_MAX_BYTES) {
      throw new Error('UPLOAD_TOO_LARGE');
    }
    return file;
  } finally {
    decodedImage?.release();
  }
}

async function uploadSourceImageBatch(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  try {
    const response = await axios.post(getStickerProcessorEndpoint('/images/upload'), formData, {
      headers: {
        Accept: 'application/json'
      },
      timeout: 60000
    });

    const imageIds = extractUploadedImageIds(response.data);
    if (!imageIds.length) {
      throw new Error('UPLOAD_RESPONSE_INVALID');
    }

    return imageIds;
  } catch (error: any) {
    if (error?.response?.status === 413) {
      if (files.length > 1) {
        const middleIndex = Math.ceil(files.length / 2);
        const leftPart = await uploadSourceImageBatch(files.slice(0, middleIndex));
        const rightPart = await uploadSourceImageBatch(files.slice(middleIndex));
        return [...leftPart, ...rightPart];
      }

      throw new Error('UPLOAD_TOO_LARGE');
    }

    if (error?.code === 'ECONNABORTED') {
      throw new Error('Загрузка изображения заняла слишком много времени. Попробуйте снова.');
    }

    if (error?.message === 'UPLOAD_RESPONSE_INVALID') {
      throw new Error('Не удалось получить идентификатор загруженного изображения.');
    }

    throw new Error(getErrorMessage(error, 'Не удалось загрузить изображение. Попробуйте снова.'));
  }
}

// ============ ТИПЫ ДЛЯ ГЕНЕРАЦИИ СТИКЕРОВ ============

export interface ArtTariffDebit {
  code: string;
  amount: number;
  description?: string;
}

export interface ArtTariffsResponse {
  debits: ArtTariffDebit[];
  credits?: ArtTariffDebit[];
}

export interface StylePreset {
  id: number;
  code: string;
  name: string;
  description: string;
  promptSuffix: string;
  isGlobal: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export interface GenerateRequest {
  prompt: string;
  stylePresetId?: number | null;
  seed?: number | null;
  removeBackground?: boolean;
}

export type GenerateModelType = 'flux-schnell' | 'nanabanana';

export interface GenerateRequestV2 {
  prompt: string;
  model: GenerateModelType;
  stylePresetId?: number | null;
  seed?: number | null;
  num_images?: 1;
  remove_background?: boolean;
  image_id?: string;
  image_ids?: string[];
}

export interface GenerateResponse {
  taskId: string;
}

export interface UploadImagesResponse {
  imageIds: string[];
}

export type GenerationStatus = 
  | 'PROCESSING_PROMPT'
  | 'PENDING' 
  | 'GENERATING' 
  | 'REMOVING_BACKGROUND' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'TIMEOUT';

export interface GenerationStatusResponse {
  taskId: string;
  status: GenerationStatus;
  imageUrl?: string;
  imageId?: string;
  imageFormat?: string;
  originalImageUrl?: string;
  metadata?: string;
  errorMessage?: string;
  telegramSticker?: {
    fileId?: string;
    stickerSetName?: string;
  };
}

export interface SaveImageRequest {
  imageUuid: string;
  stickerSetName?: string | null;
  emoji?: string;
}

export interface SaveImageResponse {
  stickerSetName: string;
  stickerIndex: number;
  stickerFileId: string;
  title: string;
}

export interface SaveToSetV2Request {
  taskId: string;
  userId: number;
  name: string;
  title: string;
  emoji?: string;
  wait_timeout_sec?: number;
}

export interface SaveToSetV2Response {
  operation?: string | null;
  stickerFileId?: string;
  telegramFileId?: string | null;
  stickerSetName?: string;
  title?: string;
  status?: string;
}

interface TelegramApiUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
}

export interface ReferralLinkResponse {
  code: string;
  startParam: string;
  url: string;
}

/** Пакет покупки ART за Telegram Stars — GET /api/stars/packages */
export interface StarsPackage {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  artAmount: number;
  starsPrice: number;
  discountPercent?: number | null;
  sortOrder?: number;
  createdAt?: string;
}

/** Ответ POST /api/stars/create-invoice */
export interface StarsInvoiceResponse {
  invoiceUrl: string;
  intentId: number;
  starsPackage: StarsPackage;
}

/** Последняя покупка ART за Stars — GET /api/stars/purchases/recent */
export interface StarsPurchaseRecent {
  id: number;
  packageCode: string;
  packageName: string;
  starsPaid: number;
  artCredited: number;
  createdAt: string;
}

/** Ответ GET /api/statistics — общая статистика платформы */
export interface StatisticsResponse {
  stickerSets?: { total?: number; daily?: number };
  likes?: { total?: number; daily?: number };
  art?: {
    total?: number;
    balance?: number;
    daily?: number;
    earned?: { total?: number; daily?: number };
  };
}

class ApiClient {
  private client: AxiosInstance;
  private language: string;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000, // Увеличен с 10 до 30 секунд для медленных серверов
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    this.language = this.detectLanguage();
    
    // ✅ Автоматическая инициализация auth заголовков из localStorage (для тестирования)
    this.initializeAuthFromLocalStorage();

    // Добавляем interceptor для логирования
    this.client.interceptors.request.use(
      (config) => {
        const headers = config.headers ?? {};

        // ✅ FIX: Добавляем заголовок X-Telegram-Init-Data на КАЖДЫЙ запрос в момент отправки
        // Приоритет: 1) уже установлен в запросе, 2) из defaults, 3) из getInitData() (захватчик)
        // Это гарантирует работу даже если setAuthHeaders не был вызван или был вызван поздно
        if (!headers['X-Telegram-Init-Data']) {
          // Сначала проверяем defaults (установленные через setAuthHeaders)
          let initData = this.client.defaults.headers.common['X-Telegram-Init-Data'] as string | undefined;
          let source: 'request' | 'defaults' | 'getInitData()' | 'missing' = 'defaults';
          
          // Если в defaults нет, используем захватчик (читает из Telegram.WebApp, sessionStorage, URL)
          if (!initData) {
            initData = getInitData() || undefined;
            source = initData ? 'getInitData()' : 'missing';
          }
          
          if (initData && initData.length > 0) {
            headers['X-Telegram-Init-Data'] = initData;
            
            // ✅ FIX: Детальное логирование для диагностики каждого запроса (DEV режим)
            if (import.meta.env.DEV && config.url?.startsWith('/api/')) {
              const hasQueryId = initData.includes('query_id=');
              const hasChat = initData.includes('chat=') || initData.includes('chat_type=');
              const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : hasChat ? 'CHAT' : 'UNKNOWN';
              
              console.log(`[API] ${config.method?.toUpperCase()} ${config.url} - X-Telegram-Init-Data: ${initData.length} chars (${source}, ${context})`);
              
              // Специальное логирование для inline query контекста
              if (hasQueryId && !hasChat) {
                console.log('🔍 Interceptor: initData добавлен (inline query контекст):', {
                  context,
                  hasQueryId,
                  hasChat: false,
                  initDataLength: initData.length,
                  source
                });
              }
            }
          } else if (import.meta.env.DEV && config.url?.startsWith('/api/')) {
            // Предупреждение только для API запросов (не для статики)
            console.warn(`[API] ${config.method?.toUpperCase()} ${config.url} - X-Telegram-Init-Data MISSING`);
          }
        } else if (import.meta.env.DEV && config.url?.startsWith('/api/')) {
          // Заголовок уже был установлен в запросе
          const existingHeader = headers['X-Telegram-Init-Data'] as string;
          if (existingHeader && existingHeader.length > 0) {
            console.log(`[API] ${config.method?.toUpperCase()} ${config.url} - X-Telegram-Init-Data: ${existingHeader.length} chars (from request)`);
          }
        }

        const effectiveLanguage =
          (headers['X-Language'] as string | undefined) ||
          this.language ||
          this.detectLanguage();
        headers['X-Language'] = effectiveLanguage;

        config.headers = headers;

        console.log('🌐 API запрос:', config.method?.toUpperCase(), config.url);
        
        // Детальное логирование для авторизации
        if (config.url?.includes('/auth/')) {
          const initDataHeader = config.headers['X-Telegram-Init-Data'] as string | undefined;
          const hasQueryId = initDataHeader?.includes('query_id=') || false;
          const hasChat = initDataHeader?.includes('chat=') || initDataHeader?.includes('chat_type=') || false;
          const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : hasChat ? 'CHAT' : 'UNKNOWN';
          
          console.log('🔐 Auth запрос детали:', {
            url: config.url,
            context,
            headers: {
              'X-Telegram-Init-Data': initDataHeader ? 'present' : 'missing',
              'Content-Type': config.headers['Content-Type'],
              'Accept': config.headers['Accept']
            },
            timeout: config.timeout
          });
        }
        
        return config;
      },
      (error) => {
        console.error('❌ Ошибка запроса:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log('✅ API ответ:', response.status, response.config.url);
        
        // Детальное логирование для авторизации
        if (response.config.url?.includes('/auth/')) {
          console.log('🔐 Auth ответ детали:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            headers: response.headers
          });
        }
        
        return response;
      },
      (error) => {
        if (error?.response) {
          console.error('❌ Ошибка ответа:', error.response.status, error.response.data);
        } else {
          console.error('❌ Сетевая ошибка ответа:', {
            code: error?.code,
            message: error?.message,
            url: error?.config?.url,
            method: error?.config?.method,
            timeout: error?.config?.timeout
          });
        }
        
        // Детальное логирование ошибок авторизации
        if (error.config?.url?.includes('/auth/')) {
          console.error('🔐 Auth ошибка детали:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            code: error.code,
            config: {
              url: error.config.url,
              method: error.config.method,
              headers: error.config.headers
            }
          });
        }
        
        return Promise.reject(error);
      }
    );
  }

  // ✅ Инициализация auth заголовков из localStorage (для тестирования с ModHeader)
  private initializeAuthFromLocalStorage() {
    try {
      const storedInitData = localStorage.getItem('dev_telegram_init_data');
      if (storedInitData) {
        console.log('🔐 Используется initData из localStorage для API запросов');
        this.setAuthHeaders(storedInitData);
      }
    } catch (e) {
      console.warn('Ошибка чтения dev_telegram_init_data из localStorage:', e);
    }
  }

  // Добавляем заголовки аутентификации (botName не отправляем)
  // ✅ FIX: Метод устанавливает initData ВСЕГДА, независимо от содержания
  // Пустая строка тоже отправляется - бэкенд сам решит, валидна ли она
  // При inline query initData содержит user и query_id (без chat) - это нормально
  setAuthHeaders(initData: string, language?: string) {
    // Устанавливаем заголовок ВСЕГДА, даже если initData пустая строка
    this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
    this.setLanguage(language);
    
    // Улучшенное логирование для диагностики
    if (import.meta.env.DEV) {
      const hasQueryId = initData.includes('query_id=');
      const hasChat = initData.includes('chat=') || initData.includes('chat_type=');
      const hasUser = initData.includes('user=');
      const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : 
                      hasChat ? 'CHAT' : 
                      initData ? 'UNKNOWN' : 'EMPTY';
      
      console.log('✅ Заголовки аутентификации установлены:');
      console.log('  X-Telegram-Init-Data:', initData ? `${initData.length} chars` : 'empty string');
      console.log('  Контекст:', context);
      console.log('  hasQueryId:', hasQueryId);
      console.log('  hasChat:', hasChat);
      console.log('  hasUser:', hasUser);
      
      if (context === 'INLINE_QUERY') {
        console.log('  🔍 INLINE_QUERY режим: initData валидная (user + query_id без chat)');
      } else if (context === 'EMPTY') {
        console.warn('  ⚠️ EMPTY: initData пустая - заголовок установлен, но бэкенд может отклонить');
      }
    }
  }

  setLanguage(language?: string) {
    const normalized = (language || '').trim().split('-')[0]?.toLowerCase();
    this.language = normalized || this.detectLanguage();
    this.client.defaults.headers.common['X-Language'] = this.language;
  }

  // Проверяем заголовки от Chrome расширений (ModHeader и т.п.)
  checkExtensionHeaders() {
    // ModHeader добавляет заголовки в fetch requests
    // Проверяем, есть ли заголовки от расширений
    const extensionInitData = this.client.defaults.headers.common['X-Telegram-Init-Data-Extension'];
    
    if (extensionInitData) {
      console.log('🔧 Обнаружены заголовки от Chrome расширения:');
      console.log('  X-Telegram-Init-Data-Extension:', extensionInitData);
      
      // Используем заголовки от расширения
      this.client.defaults.headers.common['X-Telegram-Init-Data'] = extensionInitData;
      this.setLanguage();
      
      return true;
    }
    
    return false;
  }

  // Получение текущих заголовков
  getHeaders(): Record<string, string> {
    return this.client.defaults.headers.common as Record<string, string>;
  }

  // Получение базового URL
  getBaseURL(): string {
    return this.client.defaults.baseURL || '';
  }

  // Получение таймаута
  getTimeout(): number {
    return this.client.defaults.timeout || 0;
  }

  // Генерация ключа кеша для запроса
  getCacheKey(url: string, params?: any): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }
    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `${url}?${queryString}`;
  }

  // Общая статистика платформы (GET /api/statistics)
  async getStatistics(): Promise<StatisticsResponse> {
    return requestDeduplicator.fetch(
      '/statistics',
      async () => {
        const response = await this.client.get<StatisticsResponse>('/statistics');
        return response.data;
      },
      {},
      { skipCache: false }
    );
  }

  // Удаляем заголовки аутентификации
  clearAuthHeaders() {
    delete this.client.defaults.headers.common['X-Telegram-Init-Data'];
    delete this.client.defaults.headers.common['X-Telegram-Bot-Name'];
    delete this.client.defaults.headers.common['X-Language'];
    console.log('🧹 Заголовки аутентификации удалены');
  }

  private detectLanguage(): string {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0]?.toLowerCase() || 'en';
    }
    return 'en';
  }

  // Получение категорий стикеров
  // API возвращает список CategoryDto с локализованными названиями
  // Поддерживает заголовок X-Language (ru/en) для локализации
  async getCategories(): Promise<CategoryResponse[]> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/categories',
      async () => {
        try {
          const response = await this.client.get<CategoryResponse[]>('/categories');
          // API возвращает массив активных категорий, отсортированных по displayOrder
          return response.data.filter(cat => cat.isActive);
        } catch (error) {
          console.warn('⚠️ Не удалось загрузить категории с API, используем fallback');
          // Fallback категории, если API недоступен
          return [
        { id: 1, key: 'animals', name: 'Animals', description: 'Stickers with animals', displayOrder: 1, isActive: true },
        { id: 2, key: 'memes', name: 'Memes', description: 'Popular memes', displayOrder: 2, isActive: true },
        { id: 3, key: 'emotions', name: 'Emotions', description: 'Express emotions', displayOrder: 3, isActive: true },
        { id: 4, key: 'cute', name: 'Cute', description: 'Cute and funny stickers', displayOrder: 4, isActive: true },
        { id: 5, key: 'anime', name: 'Anime', description: 'Anime characters', displayOrder: 5, isActive: true },
        { id: 6, key: 'cartoons', name: 'Cartoons', description: 'Cartoon characters', displayOrder: 6, isActive: true },
        { id: 7, key: 'food', name: 'Food', description: 'Food and drinks stickers', displayOrder: 7, isActive: true },
        { id: 8, key: 'nature', name: 'Nature', description: 'Nature and landscapes', displayOrder: 8, isActive: true },
        { id: 9, key: 'people', name: 'People', description: 'People and celebrities', displayOrder: 9, isActive: true },
        { id: 10, key: 'holidays', name: 'Holidays', description: 'Holiday stickers', displayOrder: 10, isActive: true },
        { id: 11, key: 'work', name: 'Work', description: 'Work-related stickers', displayOrder: 11, isActive: true },
        { id: 12, key: 'love', name: 'Love', description: 'Romantic stickers', displayOrder: 12, isActive: true },
        { id: 13, key: 'funny', name: 'Funny', description: 'Humorous stickers', displayOrder: 13, isActive: true },
        { id: 14, key: 'sports', name: 'Sports', description: 'Sports stickers', displayOrder: 14, isActive: true },
        { id: 15, key: 'music', name: 'Music', description: 'Music stickers', displayOrder: 15, isActive: true },
        { id: 16, key: 'technology', name: 'Technology', description: 'Technology and electronics stickers', displayOrder: 16, isActive: true },
        { id: 17, key: 'movies', name: 'Movies', description: 'Movie and TV series stickers', displayOrder: 17, isActive: true }
          ];
        }
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение списка стикерсетов с пагинацией и фильтрацией
  async getStickerSets(
    page: number = 0, 
    size: number = 20,
    options?: {
      categoryKeys?: string[]; // Фильтр по категориям (массив ключей)
      authorId?: number;
      userId?: number;          // Фильтр по пользователю (Telegram ID)
      hasAuthorOnly?: boolean;
      officialOnly?: boolean;
      type?: 'USER' | 'OFFICIAL'; // Фильтр по типу стикерсета
      likedOnly?: boolean;     // Только лайкнутые
      sort?: string;           // Поле для сортировки
      direction?: 'ASC' | 'DESC'; // Направление сортировки
      preview?: boolean;       // Возвращать только 3 случайных стикера для предпросмотра
    }
  ): Promise<StickerSetListResponse> {
    const params: Record<string, any> = { page, size };
    
    if (options?.categoryKeys && options.categoryKeys.length > 0) {
      // API ожидает строку через запятую
      params.categoryKeys = options.categoryKeys.join(',');
    }
    
    if (options?.likedOnly) {
      params.likedOnly = true;
    }
    
    if (options?.sort) {
      params.sort = options.sort;
    }
    
    if (options?.direction) {
      params.direction = options.direction;
    }

    if (typeof options?.authorId === 'number') {
      params.authorId = options.authorId;
    }

    if (typeof options?.userId === 'number') {
      params.userId = options.userId;
    }

    if (typeof options?.hasAuthorOnly === 'boolean') {
      params.hasAuthorOnly = options.hasAuthorOnly;
    }

    if (typeof options?.officialOnly === 'boolean') {
      params.officialOnly = options.officialOnly;
    }

    // Добавляем поддержку фильтра по типу стикерсета
    if (options?.type) {
      params.type = options.type;
    }

    if (typeof options?.preview === 'boolean') {
      params.preview = options.preview;
    }
    
    // ✅ P1 OPTIMIZATION: Request deduplication для предотвращения дублирующихся запросов
    // ⚠️ FIX: Запросы с likedOnly не кэшируем (они часто меняются)
    const shouldSkipCache = options?.likedOnly === true;
    
    return requestDeduplicator.fetch(
      `/stickersets`,
      async () => {
    const response = await this.client.get<StickerSetListResponse>('/stickersets', { params });
    return response.data;
      },
      params,
      { skipCache: shouldSkipCache }
    );
  }

  async getStickerSetsByAuthor(authorId: number, page: number = 0, size: number = 20, sort: string = 'createdAt', direction: 'ASC' | 'DESC' = 'DESC', preview?: boolean): Promise<StickerSetListResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/stickersets/author/${authorId}`,
      async () => {
        const params: Record<string, any> = { page, size, sort, direction };
        if (typeof preview === 'boolean') {
          params.preview = preview;
        }
        const response = await this.client.get<StickerSetListResponse>(`/stickersets/author/${authorId}`, {
          params
        });
        return response.data;
      },
      { authorId, page, size, sort, direction, preview }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  async getTelegramUser(userId: number): Promise<TelegramApiUser> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}`,
      async () => {
        const response = await this.client.get<TelegramApiUser>(`/users/${userId}`);
        return response.data;
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Регистрация уже существующего стикерсета (POST /stickersets)
  async createStickerSet(payload: CreateStickerSetRequest): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>('/stickersets', payload);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка при создании стикерсета:', error);
      throw error;
    }
  }

  // POST /stickersets/create — создаёт новый стикерсет в Telegram через Bot API и регистрирует в БД
  async createNewStickerSet(payload: CreateStickerSetCreateRequest): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>('/stickersets/create', payload);
      return response.data;
    } catch (error: any) {
      const data = error?.response?.data;
      console.error('❌ Ошибка при создании нового стикерсета:', data ?? error);
      const validation = data?.validationErrors;
      const validationMsg = validation && typeof validation === 'object'
        ? Object.values(validation).flat().filter(Boolean).join('. ')
        : null;
      const msg = validationMsg ?? data?.message ?? data?.error ?? error?.message ?? 'Не удалось создать набор. Попробуйте позже.';
      throw new Error(typeof msg === 'string' ? msg : String(msg));
    }
  }

  // Поиск стикерсетов по названию с поддержкой фильтров
  async searchStickerSets(
    query: string,
    page: number = 0,
    size: number = 20,
    options?: {
      categoryKeys?: string[];
      type?: 'USER' | 'OFFICIAL';
      authorId?: number;
      userId?: number;
      likedOnly?: boolean;
      sort?: string;
      direction?: 'ASC' | 'DESC';
      preview?: boolean;       // Возвращать только 3 случайных стикера для предпросмотра
    }
  ): Promise<StickerSetListResponse> {
    const params: Record<string, any> = { query, page, size };
    
    if (options?.categoryKeys && options.categoryKeys.length > 0) {
      params.categoryKeys = options.categoryKeys.join(',');
    }
    
    if (options?.type) {
      params.type = options.type;
    }
    
    if (options?.likedOnly) {
      params.likedOnly = true;
    }
    
    if (options?.sort) {
      params.sort = options.sort;
    }
    
    if (options?.direction) {
      params.direction = options.direction;
    }

    if (typeof options?.authorId === 'number') {
      params.authorId = options.authorId;
    }

    if (typeof options?.userId === 'number') {
      params.userId = options.userId;
    }

    if (typeof options?.preview === 'boolean') {
      params.preview = options.preview;
    }
    
    const response = await this.client.get<StickerSetListResponse>('/stickersets/search', {
      params
    });
    return response.data;
  }

  // Получение стикерсета по ID
  async getStickerSet(id: number): Promise<StickerSetResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/stickersets/${id}`,
      async () => {
        const response = await this.client.get<StickerSetResponse>(`/stickersets/${id}`);
        return response.data;
      },
      { id }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение случайного стикерсета для свайпа
  // API endpoint: GET /api/stickersets/random
  async getRandomStickerSet(): Promise<StickerSetResponse> {
    const response = await this.client.get<StickerSetResponse>('/stickersets/random');
    return response.data;
  }

  // Свайп-лайк стикерсета
  // API endpoint: POST /api/likes/stickersets/{id}?isSwipe=true
  async swipeLikeStickerSet(stickerSetId: number): Promise<any> {
    const response = await this.client.post(`/likes/stickersets/${stickerSetId}`, null, {
      params: { isSwipe: true }
    });
    return response.data;
  }

  // Свайп-дизлайк стикерсета
  // API endpoint: POST /api/dislikes/stickersets/{id}?isSwipe=true
  async swipeDislikeStickerSet(stickerSetId: number): Promise<any> {
    const response = await this.client.post(`/dislikes/stickersets/${stickerSetId}`, null, {
      params: { isSwipe: true }
    });
    return response.data;
  }

  // Статистика свайпов
  // API endpoint: GET /api/swipes/stats
  async getSwipeStats(): Promise<SwipeStatsResponse> {
    const response = await this.client.get<SwipeStatsResponse>('/swipes/stats');
    return response.data;
  }

  // Метаданные набора: автор и лайки
  async getStickerSetMeta(id: number): Promise<StickerSetMeta> {
    try {
      // Сначала пытаемся получить полную информацию о стикерсете
      const stickerSet = await this.getStickerSet(id);
      
      // Извлекаем метаданные из основного объекта стикерсета
      // Используем type assertion для доступа к дополнительным полям
      const extendedStickerSet = stickerSet as StickerSetResponse & {
        userId?: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
        likes?: number;
      };
      
      return {
        stickerSetId: id,
        author: {
          id: extendedStickerSet.userId || 1,
          username: extendedStickerSet.username || 'unknown',
          firstName: extendedStickerSet.firstName || 'Unknown',
          lastName: extendedStickerSet.lastName || '',
          avatarUrl: extendedStickerSet.avatarUrl
        },
        likes: extendedStickerSet.likes || Math.floor(100 + Math.random() * 900)
      };
    } catch (error) {
      console.warn('⚠️ API метаданных недоступен, используем мок значения');
      return {
        stickerSetId: id,
        author: {
          id: 1,
          username: 'mockauthor',
          firstName: 'Mock',
          lastName: 'Author',
          avatarUrl: 'https://via.placeholder.com/64x64/1976d2/ffffff?text=MA'
        },
        likes: Math.floor(100 + Math.random() * 900)
      };
    }
  }

  // Обновление категорий стикерсета
  async updateStickerSetCategories(id: number, categoryKeys: string[]): Promise<StickerSetResponse> {
    try {
      const response = await this.client.put<StickerSetResponse>(`/stickersets/${id}/categories`, categoryKeys);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при обновлении категорий стикерсета ${id}:`, error);
      throw error;
    }
  }

  async publishStickerSet(id: number): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>(`/stickersets/${id}/publish`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при публикации стикерсета ${id}:`, error);
      throw error;
    }
  }

  async unpublishStickerSet(id: number): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>(`/stickersets/${id}/unpublish`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при скрытии стикерсета ${id}:`, error);
      throw error;
    }
  }

  async blockStickerSet(id: number, reason?: string | null): Promise<StickerSetResponse> {
    try {
      const payload =
        typeof reason === 'string' && reason.trim().length > 0
          ? { reason: reason.trim() }
          : {};
      const response = await this.client.put<StickerSetResponse>(`/stickersets/${id}/block`, payload);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при блокировке стикерсета ${id}:`, error);
      throw error;
    }
  }

  async unblockStickerSet(id: number): Promise<StickerSetResponse> {
    try {
      const response = await this.client.put<StickerSetResponse>(`/stickersets/${id}/unblock`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при разблокировке стикерсета ${id}:`, error);
      throw error;
    }
  }

  // AI-подбор категорий по заголовку
  async suggestCategoriesForTitle(title: string): Promise<CategorySuggestionResult> {
    try {
      const response = await this.client.get<CategorySuggestionResult>('/categories/ai/suggest', {
        params: { title }
      });
      return response.data;
    } catch (error: any) {
      console.warn('⚠️ Не удалось получить рекомендации категорий от AI:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async suggestCategoriesForStickerSet(
    id: number,
    options: { apply?: boolean; minConfidence?: number } = {}
  ): Promise<CategorySuggestionResult> {
    try {
      const response = await this.client.post<CategorySuggestionResult>(
        `/stickersets/${id}/ai/suggest-categories`,
        null,
        {
          params: {
            apply: options.apply ?? false,
            minConfidence: options.minConfidence
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при запросе AI категорий для стикерсета ${id}:`, error);
      throw error;
    }
  }

  // Удаление стикерсета
  async deleteStickerSet(id: number): Promise<void> {
    await this.client.delete(`/stickersets/${id}`);
  }

  // Проверка статуса аутентификации
  async checkAuthStatus(): Promise<AuthResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/auth/status',
      async () => {
        console.log('🔐 Проверка статуса авторизации...');
        const response = await this.client.get<AuthResponse>('/auth/status');
        console.log('✅ Статус авторизации получен:', response.data);
        return response.data;
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение стикера по file_id
  async getSticker(fileId: string): Promise<Blob> {
    const response = await axios.get(buildStickerUrl(fileId), {
      responseType: 'blob'
    });
    return response.data;
  }

  // Создание URL для стикера
  getStickerUrl(fileId: string): string {
    return buildStickerUrl(fileId);
  }

  // ============ МЕТОДЫ ДЛЯ ЛАЙКОВ ============

  // Переключить лайк стикерсета (только для fallback-сценариев)
  // API endpoint: PUT /api/likes/stickersets/{stickerSetId}/toggle
  // Сервер может вернуть { liked, totalLikes } или { isLiked, totalLikes } — нормализуем к isLiked
  async toggleLike(stickerSetId: number): Promise<{ isLiked: boolean; totalLikes: number }> {
    try {
      const response = await this.client.put<{ isLiked?: boolean; liked?: boolean; totalLikes: number }>(
        `/likes/stickersets/${stickerSetId}/toggle`
      );
      const data = response.data;
      const isLiked = data.isLiked ?? data.liked ?? false;
      return { isLiked, totalLikes: data.totalLikes ?? 0 };
    } catch (error: any) {
      const status = error.response?.status;
      const msg = getErrorMessage(error, status === 500 ? 'Попробуйте позже.' : 'Не удалось изменить лайк. Попробуйте позже.');
      console.error(`❌ Ошибка при переключении лайка стикерсета ${stickerSetId}:`, status, error.response?.data ?? error.message);
      throw new Error(status === 500 ? `Сервер не смог обработать лайк. ${msg}` : msg);
    }
  }

  // Поставить лайк стикерсету (явная установка isLiked=true)
  // API endpoint: POST /api/likes/stickersets/{stickerSetId}
  async likeStickerSet(stickerSetId: number): Promise<{ isLiked: boolean; totalLikes: number }> {
    try {
      const response = await this.client.post<{ isLiked?: boolean; liked?: boolean; totalLikes: number }>(
        `/likes/stickersets/${stickerSetId}`
      );
      const data = response.data;
      const isLiked = data.isLiked ?? data.liked ?? true;
      return { isLiked, totalLikes: data.totalLikes ?? 0 };
    } catch (error: any) {
      const status = error.response?.status;
      const msg = getErrorMessage(error, 'Не удалось поставить лайк. Попробуйте позже.');
      console.error(`❌ Ошибка при установке лайка для стикерсета ${stickerSetId}:`, status, error.response?.data ?? error.message);
      throw new Error(status === 500 ? `Сервер не смог обработать лайк. ${msg}` : msg);
    }
  }

  // Убрать лайк стикерсета (явная установка isLiked=false)
  // API endpoint: DELETE /api/likes/stickersets/{stickerSetId}
  async unlikeStickerSet(stickerSetId: number): Promise<{ isLiked: boolean; totalLikes: number }> {
    try {
      const response = await this.client.delete<{ isLiked?: boolean; liked?: boolean; totalLikes: number }>(
        `/likes/stickersets/${stickerSetId}`
      );
      const data = response.data;
      const isLiked = data.isLiked ?? data.liked ?? false;
      return { isLiked, totalLikes: data.totalLikes ?? 0 };
    } catch (error: any) {
      const status = error.response?.status;
      const msg = getErrorMessage(error, 'Не удалось убрать лайк. Попробуйте позже.');
      console.error(`❌ Ошибка при снятии лайка для стикерсета ${stickerSetId}:`, status, error.response?.data ?? error.message);
      throw new Error(status === 500 ? `Сервер не смог обработать лайк. ${msg}` : msg);
    }
  }

  // Получить все лайкнутые стикерсеты текущего пользователя
  // API endpoint: GET /api/likes/stickersets
  async getLikedStickerSets(page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>('/likes/stickersets', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка при получении лайкнутых стикерсетов:', error);
      throw error;
    }
  }

  // Получить топ стикерсетов по лайкам
  // API endpoint: GET /api/likes/top-stickersets
  async getTopStickerSetsByLikes(limit: number = 10): Promise<StickerSetResponse[]> {
    try {
      const response = await this.client.get<StickerSetResponse[]>('/likes/top-stickersets', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка при получении топ стикерсетов:', error);
      throw error;
    }
  }

  // ============ МЕТОДЫ ДЛЯ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ============

  // Получение профиля пользователя по Telegram userId: GET /api/users/{userId}/profile
  // Вспомогательная функция для маппинга ProfileResponse → UserInfo
  private mapProfileToUserInfo(data: ProfileResponse): UserInfo {
    return {
        id: data.userId,
        telegramId: data.userId,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        avatarUrl: undefined,
        role: data.role,
        artBalance: data.artBalance,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        telegramUserInfo: {
          user: {
            id: data.userId,
            is_bot: false,
            first_name: data.user.firstName || '',
            last_name: data.user.lastName || '',
            username: data.user.username || '',
            language_code: data.user.languageCode || '',
            is_premium: !!data.user.isPremium
          },
          status: 'ok'
        }
      };
  }

  // Профиль по profileId: GET /api/profiles/{profileId}
  async getProfileById(profileId: number): Promise<UserInfo> {
    return requestDeduplicator.fetch(
      `/profiles/${profileId}`,
      async () => {
        const response = await this.client.get<ProfileResponse>(`/profiles/${profileId}`);
        return this.mapProfileToUserInfo(response.data);
      },
      { profileId },
      { skipCache: false }
    );
  }

  async getProfile(userId: number): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}/profile`,
      async () => {
        try {
          const response = await this.client.get<ProfileResponse>(`/users/${userId}/profile`);
          return this.mapProfileToUserInfo(response.data);
        } catch (error) {
          console.warn('⚠️ API недоступен, используем мок данные для профиля');
          // Фоллбек к мокам при девелопменте вне Telegram
          return {
            id: userId,
            telegramId: userId,
            username: 'mockuser',
            firstName: 'Mock',
            lastName: 'User',
            avatarUrl: undefined,
            role: 'USER',
            artBalance: 100,
            createdAt: new Date().toISOString()
          } as UserInfo;
        }
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  async getProfileStrict(userId: number): Promise<ProfileResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}/profile`,
      async () => {
        const response = await this.client.get<ProfileResponse>(`/users/${userId}/profile`);
        return response.data;
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // ✅ REFACTORED: Профиль текущего пользователя через /api/profiles/me
  // Возвращает UserInfo для единообразия с getProfile(userId)
  async getMyProfile(): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/profiles/me',
      async () => {
        const response = await this.client.get<ProfileResponse>('/profiles/me');
        return this.mapProfileToUserInfo(response.data);
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получить raw ProfileResponse текущего пользователя (если нужен полный ответ)
  async getMyProfileRaw(): Promise<ProfileResponse> {
    const response = await this.client.get<ProfileResponse>('/profiles/me');
    return response.data;
  }

  // Реферальная ссылка: GET /api/referrals/me/link
  async getReferralLink(): Promise<ReferralLinkResponse> {
    const response = await this.client.get<ReferralLinkResponse>('/referrals/me/link');
    return response.data;
  }

  // Фото профиля: GET /api/users/{userId}/photo
  async getUserPhoto(userId: number): Promise<{ profilePhotoFileId?: string; profilePhotos?: any } | null> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}/photo`,
      async () => {
        try {
          const response = await this.client.get<any>(`/users/${userId}/photo`);
          const data = response.data;
          return {
            profilePhotoFileId: data.profilePhotoFileId,
            profilePhotos: data.profilePhotos
          };
        } catch (error: any) {
          // 404 — нет фото
          if (error?.response?.status === 404) {
            return null;
          }
          throw error;
        }
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Загрузка фото профиля как blob: через sticker-processor (как для стикеров)
  async getUserPhotoBlob(userId: number, fileId?: string): Promise<Blob> {
    if (!fileId) {
      throw new Error('fileId is required for getUserPhotoBlob');
    }
    
    // ✅ FIX: Используем sticker-processor для загрузки изображения
    // Точно так же как для стикеров: используем buildStickerUrl напрямую с axios
    const url = buildStickerUrl(fileId, { file: true });
    
    // ✅ FIX: Используем дедупликацию запросов для предотвращения двойной загрузки
    return requestDeduplicator.fetch(
      url,
      async () => {
        const response = await axios.get(url, {
          responseType: 'blob'
        });
        return response.data;
      },
      { fileId, userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем blob (TTL 5 минут)
    );
  }

  // Получение информации о пользователе по Telegram ID: /api/users/{userId}/profile
  async getUserInfo(userId: number): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}/profile`,
      async () => {
        try {
          const response = await this.client.get<ProfileResponse>(`/users/${userId}/profile`);
          const data = response.data;
      
      // Маппинг новой структуры ответа в UserInfo
      const mapped: UserInfo = {
        id: data.userId,
        telegramId: data.userId,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        avatarUrl: undefined,
        role: data.role,
        artBalance: data.artBalance,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        telegramUserInfo: {
          user: {
            id: data.userId,
            is_bot: false,
            first_name: data.user.firstName || '',
            last_name: data.user.lastName || '',
            username: data.user.username || '',
            language_code: data.user.languageCode || '',
            is_premium: !!data.user.isPremium
          },
          status: 'ok'
        }
      };
      return mapped;
        } catch (error) {
          console.warn('⚠️ API недоступен, используем мок данные для пользователя');
          // Мок данные для пользователя
          return {
            id: userId,
            telegramId: userId,
            username: 'mockuser',
            firstName: 'Mock',
            lastName: 'User',
            avatarUrl: 'https://via.placeholder.com/64x64/2481cc/ffffff?text=MU',
            role: 'USER',
            artBalance: 150,
            createdAt: '2025-09-15T10:30:00Z'
          };
        }
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение информации о текущем пользователе по Telegram ID: /api/users/{userId}/profile
  async getUserByTelegramId(telegramId: number): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${telegramId}/profile`,
      async () => {
        try {
          // API endpoint: /api/users/{userId}/profile где userId = telegramId
          const response = await this.client.get<ProfileResponse>(`/users/${telegramId}/profile`);
          const data = response.data;
      
      // Маппинг новой структуры ответа в UserInfo
      const mapped: UserInfo = {
        id: data.userId,
        telegramId: data.userId,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        avatarUrl: undefined,
        role: data.role,
        artBalance: data.artBalance,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        telegramUserInfo: {
          user: {
            id: data.userId,
            is_bot: false,
            first_name: data.user.firstName || '',
            last_name: data.user.lastName || '',
            username: data.user.username || '',
            language_code: data.user.languageCode || '',
            is_premium: !!data.user.isPremium
          },
          status: 'ok'
        }
      };
      return mapped;
        } catch (error) {
          console.warn('⚠️ API недоступен, используем мок данные для текущего пользователя');
          // Мок данные для текущего пользователя
          return {
            id: telegramId,
            telegramId: telegramId,
            username: 'currentuser',
            firstName: 'Current',
            lastName: 'User',
            avatarUrl: 'https://via.placeholder.com/64x64/4CAF50/ffffff?text=CU',
            role: 'USER',
            artBalance: 250,
            createdAt: '2025-09-15T10:30:00Z'
          };
        }
      },
      { telegramId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение лидерборда пользователей
  // API endpoint: GET /api/users/leaderboard
  async getUsersLeaderboard(page?: number, size?: number): Promise<LeaderboardResponse> {
    return requestDeduplicator.fetch(
      `/users/leaderboard`,
      async () => {
        try {
          const params: Record<string, any> = {};
          if (page !== undefined) params.page = page;
          if (size !== undefined) params.size = size;
          
          const response = await this.client.get<LeaderboardResponse>('/users/leaderboard', {
            params: Object.keys(params).length > 0 ? params : undefined
          });
          return response.data;
        } catch (error: any) {
          console.error('❌ Ошибка загрузки лидерборда:', error);
          // Возвращаем пустой лидерборд при ошибке
          return {
            content: [],
            page: page ?? 0,
            size: size ?? 20,
            totalElements: 0,
            totalPages: 0,
            first: true,
            last: true,
            hasNext: false,
            hasPrevious: false
          };
        }
      },
      { page, size }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение лидерборда авторов
  // API endpoint: GET /api/authors/leaderboard?visibility=PUBLIC
  async getAuthorsLeaderboard(page?: number, size?: number): Promise<AuthorsLeaderboardResponse> {
    return requestDeduplicator.fetch(
      `/authors/leaderboard`,
      async () => {
        try {
          const params: Record<string, any> = {
            visibility: 'PUBLIC'
          };
          if (page !== undefined) params.page = page;
          if (size !== undefined) params.size = size;
          
          const response = await this.client.get<AuthorsLeaderboardResponse>('/authors/leaderboard', {
            params
          });
          return response.data;
        } catch (error: any) {
          console.error('❌ Ошибка загрузки лидерборда авторов:', error);
          // Возвращаем пустой лидерборд при ошибке
          return {
            content: [],
            page: page ?? 0,
            size: size ?? 20,
            totalElements: 0,
            totalPages: 0,
            first: true,
            last: true,
            hasNext: false,
            hasPrevious: false
          };
        }
      },
      { page, size, visibility: 'PUBLIC' }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение стикерсетов пользователя по userId
  // shortInfo=true — вернуть только локальную информацию без telegramStickerSetInfo
  async getUserStickerSets(
    userId: number,
    page: number = 0,
    size: number = 20,
    sort: 'createdAt' | 'title' | 'name' = 'createdAt',
    direction: 'ASC' | 'DESC' = 'DESC',
    preview?: boolean,
    shortInfo?: boolean,
    isVerified?: boolean,
    type?: 'USER' | 'OFFICIAL',
    visibility?: string,
    likedOnly?: boolean
  ): Promise<StickerSetListResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/stickersets/user/${userId}`,
      async () => {
        try {
          const params: Record<string, any> = { page, size, sort, direction };
          if (typeof preview === 'boolean') {
            params.preview = preview;
          }
          if (typeof shortInfo === 'boolean') {
            params.shortInfo = shortInfo;
          }
          if (typeof isVerified === 'boolean') {
            params.isVerified = isVerified;
          }
          if (type) {
            params.type = type;
          }
          if (visibility) {
            params.visibility = visibility;
          }
          if (typeof likedOnly === 'boolean') {
            params.likedOnly = likedOnly;
          }
          const response = await this.client.get<StickerSetListResponse>(`/stickersets/user/${userId}`, {
            params
          });
          return response.data;
        } catch (error) {
          console.warn('⚠️ API недоступен, используем мок данные для стикерсетов пользователя');
          // Фильтруем мок данные по userId (для демонстрации)
          const userMockSets = mockStickerSets.filter(set => (set as any).userId === userId || userId === 777000);
          
          return {
            content: userMockSets,
            totalElements: userMockSets.length,
            totalPages: Math.ceil(userMockSets.length / size),
            size: size,
            number: page,
            first: page === 0,
            last: page >= Math.ceil(userMockSets.length / size) - 1,
            numberOfElements: userMockSets.length
          };
        }
      },
      { userId, page, size, sort, direction, preview, shortInfo, isVerified, type, visibility, likedOnly }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Поиск стикерсетов пользователя по названию
  async searchUserStickerSets(userId: number, query: string, page: number = 0, size: number = 20, preview?: boolean): Promise<StickerSetListResponse> {
    try {
      const params: Record<string, any> = { query, page, size, userId };
      if (typeof preview === 'boolean') {
        params.preview = preview;
      }
      const response = await this.client.get<StickerSetListResponse>(`/stickersets/search`, {
        params
      });
      return response.data;
    } catch (error) {
      console.warn('⚠️ API поиска недоступен, используем локальную фильтрацию');
      // Локальная фильтрация мок данных
       const userMockSets = mockStickerSets.filter(set => 
        ((set as any).userId === userId || userId === 777000) &&
        (set.title.toLowerCase().includes(query.toLowerCase()) ||
         set.name.toLowerCase().includes(query.toLowerCase()))
      );
      
      return {
        content: userMockSets,
        totalElements: userMockSets.length,
        totalPages: Math.ceil(userMockSets.length / size),
        size: size,
        number: page,
        first: page === 0,
        last: page >= Math.ceil(userMockSets.length / size) - 1,
        numberOfElements: userMockSets.length
      };
    }
  }

  // Поиск стикерсетов автора по названию
  async searchAuthorStickerSets(authorId: number, query: string, page: number = 0, size: number = 20, preview?: boolean): Promise<StickerSetListResponse> {
    try {
      const params: Record<string, any> = { query, page, size, authorId };
      if (typeof preview === 'boolean') {
        params.preview = preview;
      }
      const response = await this.client.get<StickerSetListResponse>(`/stickersets/search`, {
        params
      });
      return response.data;
    } catch (error) {
      console.warn('⚠️ API поиска недоступен, используем локальную фильтрацию');
      // Локальная фильтрация мок данных
       const authorMockSets = mockStickerSets.filter(set => 
        ((set as any).authorId === authorId || authorId === 777000) &&
        (set.title.toLowerCase().includes(query.toLowerCase()) ||
         set.name.toLowerCase().includes(query.toLowerCase()))
      );
      
      return {
        content: authorMockSets,
        totalElements: authorMockSets.length,
        totalPages: Math.ceil(authorMockSets.length / size),
        size: size,
        number: page,
        first: page === 0,
        last: page >= Math.ceil(authorMockSets.length / size) - 1,
        numberOfElements: authorMockSets.length
      };
    }
  }

  // Загрузка стикерпака по ссылке
  // API endpoint: POST /api/stickersets/import или POST /api/stickersets с параметром link
  // Параметр: link - ссылка на стикерпак (например, https://t.me/addstickers/...)
  async uploadStickerPackByLink(link: string): Promise<StickerSetResponse> {
    try {
      // Пробуем несколько возможных endpoints
      let response;
      try {
        // Вариант 1: POST /api/stickersets/import
        response = await this.client.post<StickerSetResponse>('/stickersets/import', { link });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          // Вариант 2: POST /api/stickersets с параметром link
          response = await this.client.post<StickerSetResponse>('/stickersets', null, {
            params: { link }
          });
        } else {
          throw err;
        }
      }
      console.log('✅ Стикерпак загружен:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка загрузки стикерпака:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось загрузить стикерпак. Проверьте ссылку и попробуйте снова.';
      throw new Error(errorMessage);
    }
  }

  // ============ МЕТОДЫ ДЛЯ РАБОТЫ С КОШЕЛЬКАМИ ============

  // Привязка TON-кошелька к текущему пользователю
  // API endpoint: POST /api/wallets/link
  // Все старые активные кошельки автоматически деактивируются
  async linkWallet(walletAddress: string, walletType?: string | null): Promise<UserWallet> {
    try {
      const response = await this.client.post<UserWallet>('/wallets/link', {
        walletAddress,
        walletType: walletType ?? null
      });
      console.log('✅ Кошелёк привязан:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка привязки кошелька:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось привязать кошелёк. Проверьте адрес и попробуйте снова.';
      throw new Error(errorMessage);
    }
  }

  // Получение активного TON-кошелька текущего пользователя
  // API endpoint: GET /api/wallets/my
  // Возвращает UserWallet или null, если кошелёк не привязан
  async getMyWallet(): Promise<UserWallet | null> {
    try {
      const response = await this.client.get<UserWallet | null>('/wallets/my');
      return response.data;
    } catch (error: any) {
      // 404 или пустой ответ означает, что кошелёк не привязан
      if (error?.response?.status === 404) {
        return null;
      }
      console.error('❌ Ошибка получения кошелька:', error);
      throw error;
    }
  }

  // Отключение (деактивация) текущего активного кошелька
  // API endpoint: POST /api/wallets/unlink
  // Не принимает параметры, работает в контексте авторизованного пользователя
  // Возвращает {"success": true}
  async unlinkWallet(): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post<{ success: boolean }>('/wallets/unlink');
      console.log('✅ Кошелёк успешно отключен:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка отключения кошелька:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось отключить кошелёк. Попробуйте снова.';
      throw new Error(errorMessage);
    }
  }

  // Подготовка доната автору стикерсета
  // API endpoint: POST /api/transactions/prepare
  async prepareDonation(stickerSetId: number, amountNano: number): Promise<DonationPrepareResponse> {
    try {
      const response = await this.client.post<DonationPrepareResponse>(
        '/transactions/prepare',
        { stickerSetId, amountNano }
      );
      console.log('✅ Донат подготовлен:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка подготовки доната:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось подготовить донат. Попробуйте позже.';
      throw new Error(errorMessage);
    }
  }

  // Подтверждение транзакции доната
  // API endpoint: POST /api/transactions/confirm
  async confirmDonation(intentId: number, txHash: string, fromWallet: string): Promise<DonationConfirmResponse> {
    try {
      const response = await this.client.post<DonationConfirmResponse>(
        '/transactions/confirm',
        { intentId, txHash, fromWallet }
      );
      console.log('✅ Донат подтверждён:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка подтверждения доната:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось подтвердить донат. Попробуйте позже.';
      throw new Error(errorMessage);
    }
  }

  // ============ МЕТОДЫ ДЛЯ ГЕНЕРАЦИИ СТИКЕРОВ ============

  // Пакеты покупки ART за Telegram Stars
  // API endpoint: GET /api/stars/packages
  async getStarsPackages(): Promise<StarsPackage[]> {
    try {
      const response = await this.client.get<StarsPackage[]>('/stars/packages');
      return response.data ?? [];
    } catch (error: any) {
      console.warn('⚠️ Не удалось загрузить пакеты Stars:', error);
      return [];
    }
  }

  // Создание invoice для оплаты ART за Stars
  // API endpoint: POST /api/stars/create-invoice
  async createStarsInvoice(packageCode: string): Promise<StarsInvoiceResponse> {
    const response = await this.client.post<StarsInvoiceResponse>('/stars/create-invoice', {
      packageCode
    });
    return response.data;
  }

  // Последняя покупка ART за Stars (для подтверждения после openInvoice)
  // API endpoint: GET /api/stars/purchases/recent
  async getStarsPurchasesRecent(): Promise<StarsPurchaseRecent | null> {
    try {
      const response = await this.client.get<StarsPurchaseRecent>('/stars/purchases/recent');
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  }

  // Получение тарифов ART
  // API endpoint: GET /api/art-tariffs
  async getArtTariffs(): Promise<ArtTariffsResponse> {
    return requestDeduplicator.fetch(
      '/art-tariffs',
      async () => {
        try {
          const response = await this.client.get<ArtTariffsResponse>('/art-tariffs');
          return response.data;
        } catch (error: any) {
          console.warn('⚠️ Не удалось загрузить тарифы ART:', error);
          // Fallback тарифы
          return {
            debits: [
              { code: 'GENERATE_STICKER', amount: 10, description: 'Генерация стикера' }
            ]
          };
        }
      },
      {},
      { skipCache: false }
    );
  }

  // Запуск генерации стикера
  // API endpoint: POST /api/generation/generate
  async generateSticker(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const response = await this.client.post<GenerateResponse>('/generation/generate', request);
      console.log('✅ Генерация запущена:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка запуска генерации:', error);
      
      // Обработка специфических ошибок
      const status = error?.response?.status;
      
      if (status === 402) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      if (status === 400) {
        throw new Error('INVALID_PROMPT');
      }
      if (status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось запустить генерацию. Попробуйте позже.';
      throw new Error(errorMessage);
    }
  }

  // Запуск генерации стикера через STICKER_PROCESSOR
  // API endpoint: POST /api/generation/v2/generate
  async generateStickerV2(request: GenerateRequestV2): Promise<GenerateResponse> {
    try {
      const response = await this.client.post<GenerateResponse>('/generation/v2/generate', request, {
        timeout: 90000
      });
      console.log('✅ V2 генерация запущена:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка запуска v2 генерации:', error);

      const status = error?.response?.status;
      const code = error?.code;

      if (status === 402) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      if (status === 400) {
        throw new Error('INVALID_GENERATION_PARAMS');
      }
      if (status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (status === 404) {
        throw new Error('SOURCE_IMAGE_NOT_FOUND');
      }
      if (code === 'ECONNABORTED') {
        throw new Error('GENERATION_START_TIMEOUT');
      }

      throw new Error(getErrorMessage(error, 'Не удалось запустить генерацию. Попробуйте позже.'));
    }
  }

  async uploadSourceImages(files: File[]): Promise<UploadImagesResponse> {
    if (!files.length) {
      return { imageIds: [] };
    }

    const preparedFiles = await Promise.all(files.map((file) => optimizeUploadImage(file)));
    const preparedBatches = splitFilesIntoUploadBatches(preparedFiles, SOURCE_IMAGE_UPLOAD_BATCH_BYTES);
    const imageIds: string[] = [];

    for (const batch of preparedBatches) {
      const batchImageIds = await uploadSourceImageBatch(batch);
      imageIds.push(...batchImageIds);
    }

    return { imageIds };
  }

  // Получение статуса генерации
  // API endpoint: GET /api/generation/status/{taskId}
  async getGenerationStatus(taskId: string): Promise<GenerationStatusResponse> {
    try {
      const response = await this.client.get<GenerationStatusResponse>(`/generation/status/${taskId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка получения статуса генерации:', error);
      throw error;
    }
  }

  // Получение статуса v2 генерации
  // API endpoint: GET /api/generation/v2/status/{taskId}
  async getGenerationStatusV2(taskId: string): Promise<GenerationStatusResponse> {
    try {
      const response = await this.client.get<GenerationStatusResponse>(`/generation/v2/status/${taskId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка получения статуса v2 генерации:', error);
      throw error;
    }
  }

  // Получение списка доступных пресетов стилей
  // API endpoint: GET /api/generation/style-presets
  async getStylePresets(): Promise<StylePreset[]> {
    try {
      const response = await this.client.get<StylePreset[]>('/generation/style-presets');
      // Сортируем по sortOrder и фильтруем только активные
      const activePresets = response.data
        .filter(preset => preset.isEnabled)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return activePresets;
    } catch (error: any) {
      console.error('❌ Ошибка получения пресетов стилей:', error);
      throw error;
    }
  }

  // Сохранение сгенерированного изображения в стикерсет
  // API endpoint: POST /api/stickersets/save-image
  async saveImageToStickerSet(request: SaveImageRequest): Promise<SaveImageResponse> {
    try {
      const response = await this.client.post<SaveImageResponse>('/stickersets/save-image', request);
      console.log('✅ Изображение сохранено в стикерсет:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка сохранения изображения в стикерсет:', error);
      
      // Обработка специфических ошибок
      const status = error?.response?.status;
      
      if (status === 400) {
        const errorMessage = error?.response?.data?.error || 
                           error?.response?.data?.message || 
                           'Ошибка при сохранении стикера';
        throw new Error(errorMessage);
      }
      if (status === 404) {
        throw new Error('Изображение не найдено');
      }
      if (status === 401) {
        throw new Error('Требуется авторизация');
      }
      
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось сохранить стикер. Попробуйте позже.';
      throw new Error(errorMessage);
    }
  }

  // Сохранение сгенерированного v2-стикера в Telegram set через STICKER_PROCESSOR
  // API endpoint: POST /api/generation/v2/save-to-set
  async saveToStickerSetV2(request: SaveToSetV2Request): Promise<SaveToSetV2Response> {
    try {
      const response = await this.client.post<SaveToSetV2Response | string>('/generation/v2/save-to-set', request);
      const responseData = typeof response.data === 'object' && response.data !== null ? response.data : {};
      if (!responseData.stickerFileId && responseData.telegramFileId) {
        responseData.stickerFileId = responseData.telegramFileId;
      }
      if (!responseData.status) {
        responseData.status = String(response.status);
      }
      console.log('✅ V2 стикер сохранён в набор:', responseData);
      return responseData;
    } catch (error: any) {
      console.error('❌ Ошибка сохранения v2-стикера в набор:', error);

      const status = error?.response?.status;

      if (status === 401) {
        throw new Error('Требуется авторизация');
      }
      if (status === 404) {
        throw new Error('Задача генерации не найдена');
      }
      if (status === 410) {
        throw new Error('Результат генерации больше недоступен');
      }
      if (status === 422) {
        throw new Error(getErrorMessage(error, 'Стикер не удалось сохранить в набор'));
      }
      if (status === 424) {
        throw new Error(getErrorMessage(error, 'Ошибка upstream при сохранении стикера'));
      }

      throw new Error(getErrorMessage(error, 'Не удалось сохранить стикер. Попробуйте позже.'));
    }
  }
}

export const apiClient = new ApiClient();
